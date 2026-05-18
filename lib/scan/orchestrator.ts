import { gmailClient, listBillingMessageIds, getFullMessage, parseSender, type FullMessage } from "@/lib/gmail";
import { shouldProcessEmail } from "@/lib/heuristic";
import { supabaseAdmin } from "@/lib/supabase";
import { embed, toPgVector } from "./embed";
import { clusterPendingEvents } from "./cluster";
import { classifyClusters } from "./classify";
import { enrichUnresolvedEvents } from "./enrich";
import { detectSubscriptions } from "./trend";

const SCAN_DAYS = 730;

export type ScanEvent =
  | { type: "stage"; stage: string; message: string }
  | { type: "progress"; current: number; total: number; stage: string }
  | { type: "found"; service: string; status: string; evidence: string; amount: number | null; currency: string | null; cycle: string | null }
  | { type: "summary"; confirmed: number; possible: number; canceled: number; trial: number }
  | { type: "error"; message: string }
  | { type: "done" };

export interface AccountRow {
  id: string;
  user_id: string;
  google_email: string;
  google_refresh_token: string;
}

export async function runScan(
  account: AccountRow,
  emit?: (event: ScanEvent) => void,
): Promise<void> {
  const log = emit ?? (() => {});
  const db = supabaseAdmin();
  const gmail = gmailClient(account.google_refresh_token);
  const since = new Date(Date.now() - SCAN_DAYS * 86_400_000);

  log({ type: "stage", stage: "gmail", message: "Searching Gmail for billing emails…" });
  const ids = await listBillingMessageIds(gmail, since, 500);
  log({ type: "stage", stage: "gmail", message: `Found ${ids.length} candidate emails` });

  // Pull existing message IDs we've already ingested for this user/account
  const { data: existingRows } = await db
    .from("email_events")
    .select("gmail_message_id")
    .eq("user_id", account.user_id)
    .eq("gmail_account_id", account.id);
  const existing = new Set((existingRows ?? []).map((r) => r.gmail_message_id));
  const newIds = ids.filter((id) => !existing.has(id));

  log({ type: "stage", stage: "filter", message: `${newIds.length} new emails to ingest (${ids.length - newIds.length} already seen)` });

  // Pull metadata + body, heuristic, embed, insert
  let processed = 0;
  let kept = 0;
  for (const id of newIds) {
    let full: FullMessage;
    try {
      full = await getFullMessage(gmail, id, 5000);
    } catch {
      processed++;
      continue;
    }
    processed++;
    log({ type: "progress", current: processed, total: newIds.length, stage: "ingest" });

    if (!shouldProcessEmail(full.subject, full.snippet || full.body.slice(0, 500))) continue;
    const { email: senderEmail, domain: senderDomain } = parseSender(full.from);

    // Embed (subject + first 800 of body gives best clustering signal)
    let embedding: number[];
    try {
      embedding = await embed(`${full.subject}\n${full.body.slice(0, 800)}`);
    } catch (err) {
      log({ type: "error", message: `Embed failed for ${id}: ${String(err).slice(0, 80)}` });
      continue;
    }

    const sentAt = full.internalDate ? new Date(full.internalDate).toISOString() : null;
    const { error: insertErr } = await db.from("email_events").insert({
      user_id: account.user_id,
      gmail_account_id: account.id,
      gmail_message_id: id,
      subject: full.subject,
      sender_email: senderEmail,
      sender_domain: senderDomain,
      sent_at: sentAt,
      embedding: toPgVector(embedding),
      raw_extract: { body: full.body, snippet: full.snippet },
    });
    if (!insertErr) kept++;
  }

  log({ type: "stage", stage: "filter", message: `${kept} emails embedded and stored` });

  // Cluster
  log({ type: "stage", stage: "cluster", message: "Clustering near-duplicate emails…" });
  const clusterRes = await clusterPendingEvents(account.user_id);
  log({ type: "stage", stage: "cluster", message: `${clusterRes.assigned} events grouped into ${clusterRes.clusters} new clusters` });

  // Classify clusters via Groq
  log({ type: "stage", stage: "classify", message: "Classifying clusters with Groq…" });
  await classifyClusters(account.user_id, account.google_email, (done, total) => {
    log({ type: "progress", current: done, total, stage: "classify" });
  });

  // Brand enrichment
  log({ type: "stage", stage: "enrich", message: "Resolving brand names and logos…" });
  await enrichUnresolvedEvents(account.user_id);

  // Trend detection
  log({ type: "stage", stage: "trend", message: "Running pattern detection…" });
  const result = await detectSubscriptions(account.user_id);
  log({ type: "summary", confirmed: result.confirmed, possible: result.possible, canceled: result.canceled, trial: result.trial });

  // Update gmail_account watermark
  await db
    .from("gmail_accounts")
    .update({
      scanned_through_date: since.toISOString().slice(0, 10),
    })
    .eq("id", account.id);

  log({ type: "done" });
}
