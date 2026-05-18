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

  // ── 1. Fetch Gmail message IDs ──────────────────────────────────────────
  log({ type: "stage", stage: "gmail", message: "Searching Gmail for billing emails…" });
  const ids = await listBillingMessageIds(gmail, since, 500);
  log({ type: "stage", stage: "gmail", message: `Found ${ids.length} candidate emails` });

  // Skip messages already ingested
  const { data: existingRows } = await db
    .from("email_events")
    .select("gmail_message_id")
    .eq("user_id", account.user_id)
    .eq("gmail_account_id", account.id);
  const existing = new Set((existingRows ?? []).map((r) => r.gmail_message_id));
  const newIds = ids.filter((id) => !existing.has(id));
  log({ type: "stage", stage: "filter", message: `${newIds.length} new emails to process (${ids.length - newIds.length} already seen)` });

  // ── 2. Fetch, filter, embed, insert ────────────────────────────────────
  let processed = 0;
  let ingested = 0;
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

    const keep = shouldProcessEmail(full.subject, full.snippet || full.body.slice(0, 500));
    if (!keep) continue;

    const { email: senderEmail, domain: senderDomain } = parseSender(full.from);
    const sentAt = full.internalDate ? new Date(full.internalDate).toISOString() : null;

    // Compute embedding server-side
    const embeddingText = `${full.subject ?? ""}\n${full.body.slice(0, 800)}`.replace(/\s+/g, " ").trim().slice(0, 2000);
    let embeddingVec: string | null = null;
    try {
      const vec = await embed(embeddingText);
      embeddingVec = toPgVector(vec);
    } catch {
      // Proceed without embedding — cluster pass will skip unembedded events
    }

    const { error: insertErr } = await db.from("email_events").insert({
      user_id: account.user_id,
      gmail_account_id: account.id,
      gmail_message_id: id,
      subject: full.subject,
      sender_email: senderEmail,
      sender_domain: senderDomain,
      sent_at: sentAt,
      embedding: embeddingVec,
      raw_extract: { body: full.body, snippet: full.snippet },
    });
    if (!insertErr) ingested++;
  }

  log({ type: "stage", stage: "ingest", message: `${ingested} emails ingested` });

  // Update watermark
  const scannedThroughDate = since.toISOString().slice(0, 10);
  await db
    .from("gmail_accounts")
    .update({ scanned_through_date: scannedThroughDate })
    .eq("id", account.id);

  // ── 3. Cluster ──────────────────────────────────────────────────────────
  log({ type: "stage", stage: "cluster", message: "Clustering similar emails…" });
  const clusterRes = await clusterPendingEvents(account.user_id);
  log({ type: "stage", stage: "cluster", message: `${clusterRes.assigned} events grouped into ${clusterRes.clusters} clusters` });

  // ── 4. Classify ─────────────────────────────────────────────────────────
  log({ type: "stage", stage: "classify", message: "Classifying clusters with Groq…" });
  await classifyClusters(account.user_id, account.google_email, (done, total) => {
    log({ type: "progress", current: done, total, stage: "classify" });
  });

  // ── 5. Enrich ───────────────────────────────────────────────────────────
  log({ type: "stage", stage: "enrich", message: "Resolving brand names and logos…" });
  await enrichUnresolvedEvents(account.user_id);

  // ── 6. Trend detection ──────────────────────────────────────────────────
  log({ type: "stage", stage: "trend", message: "Detecting recurring patterns…" });
  const result = await detectSubscriptions(account.user_id);

  log({
    type: "summary",
    confirmed: result.confirmed,
    possible: result.possible,
    canceled: result.canceled,
    trial: result.trial,
  });

  log({ type: "done" });
}
