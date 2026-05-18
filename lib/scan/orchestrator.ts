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
  | { type: "verbose"; stage: string; message: string; data?: unknown }
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
  log({
    type: "verbose",
    stage: "scan",
    message: "Scan bootstrapped",
    data: {
      userId: account.user_id,
      gmailAccountId: account.id,
      googleEmail: account.google_email,
      sinceISO: since.toISOString(),
      scanDays: SCAN_DAYS,
    },
  });

  log({ type: "stage", stage: "gmail", message: "Searching Gmail for billing emails…" });
  const ids = await listBillingMessageIds(gmail, since, 500);
  log({ type: "stage", stage: "gmail", message: `Found ${ids.length} candidate emails` });
  log({ type: "verbose", stage: "gmail", message: "Candidate message IDs", data: { ids } });

  // Pull existing message IDs we've already ingested for this user/account
  const { data: existingRows } = await db
    .from("email_events")
    .select("gmail_message_id")
    .eq("user_id", account.user_id)
    .eq("gmail_account_id", account.id);
  const existing = new Set((existingRows ?? []).map((r) => r.gmail_message_id));
  const newIds = ids.filter((id) => !existing.has(id));
  log({
    type: "verbose",
    stage: "filter",
    message: "Existing-vs-new reconciliation complete",
    data: {
      existingCount: existing.size,
      newCount: newIds.length,
      skippedCount: ids.length - newIds.length,
      existingIdsSample: Array.from(existing).slice(0, 50),
    },
  });

  log({ type: "stage", stage: "filter", message: `${newIds.length} new emails to ingest (${ids.length - newIds.length} already seen)` });

  // Pull metadata + body, heuristic, embed, insert
  let processed = 0;
  let kept = 0;
  for (const id of newIds) {
    log({ type: "verbose", stage: "ingest", message: "Fetching message payload", data: { messageId: id } });
    let full: FullMessage;
    try {
      full = await getFullMessage(gmail, id, 5000);
    } catch {
      log({ type: "verbose", stage: "ingest", message: "Failed to fetch message payload", data: { messageId: id } });
      processed++;
      continue;
    }
    processed++;
    log({ type: "progress", current: processed, total: newIds.length, stage: "ingest" });
    log({
      type: "verbose",
      stage: "ingest",
      message: "Fetched message payload",
      data: {
        messageId: id,
        subject: full.subject,
        from: full.from,
        snippet: full.snippet?.slice(0, 280) ?? null,
        bodyPreview: full.body.slice(0, 420),
        bodyLength: full.body.length,
      },
    });

    const keep = shouldProcessEmail(full.subject, full.snippet || full.body.slice(0, 500));
    if (!keep) {
      log({ type: "verbose", stage: "filter", message: "Heuristic rejected message", data: { messageId: id, subject: full.subject, from: full.from } });
      continue;
    }
    const { email: senderEmail, domain: senderDomain } = parseSender(full.from);
    log({
      type: "verbose",
      stage: "filter",
      message: "Heuristic accepted message",
      data: { messageId: id, senderEmail, senderDomain },
    });

    // Embed (subject + first 800 of body gives best clustering signal)
    let embedding: number[];
    try {
      embedding = await embed(`${full.subject}\n${full.body.slice(0, 800)}`);
    } catch (err) {
      log({ type: "error", message: `Embed failed for ${id}: ${String(err).slice(0, 80)}` });
      continue;
    }
    log({ type: "verbose", stage: "embed", message: "Embedding generated", data: { messageId: id, dimensions: embedding.length } });

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
    if (!insertErr) {
      kept++;
      log({ type: "verbose", stage: "persist", message: "Inserted email_event", data: { messageId: id, sentAt, senderEmail, senderDomain } });
    } else {
      log({ type: "verbose", stage: "persist", message: "Insert failed", data: { messageId: id, error: insertErr.message } });
    }
  }

  log({ type: "stage", stage: "filter", message: `${kept} emails embedded and stored` });

  // Cluster
  log({ type: "stage", stage: "cluster", message: "Clustering near-duplicate emails…" });
  const clusterRes = await clusterPendingEvents(account.user_id);
  log({ type: "stage", stage: "cluster", message: `${clusterRes.assigned} events grouped into ${clusterRes.clusters} new clusters` });
  log({ type: "verbose", stage: "cluster", message: "Cluster result detail", data: clusterRes });

  // Classify clusters via Groq
  log({ type: "stage", stage: "classify", message: "Classifying clusters with Groq…" });
  await classifyClusters(account.user_id, account.google_email, (done, total) => {
    log({ type: "progress", current: done, total, stage: "classify" });
    log({ type: "verbose", stage: "classify", message: "Classification progress update", data: { done, total } });
  });

  // Brand enrichment
  log({ type: "stage", stage: "enrich", message: "Resolving brand names and logos…" });
  await enrichUnresolvedEvents(account.user_id);

  // Trend detection
  log({ type: "stage", stage: "trend", message: "Running pattern detection…" });
  const result = await detectSubscriptions(account.user_id);
  log({ type: "verbose", stage: "trend", message: "Trend detection result", data: result });
  log({ type: "summary", confirmed: result.confirmed, possible: result.possible, canceled: result.canceled, trial: result.trial });

  // Update gmail_account watermark
  await db
    .from("gmail_accounts")
    .update({
      scanned_through_date: since.toISOString().slice(0, 10),
    })
    .eq("id", account.id);
  log({
    type: "verbose",
    stage: "scan",
    message: "Updated gmail account watermark",
    data: { accountId: account.id, scannedThroughDate: since.toISOString().slice(0, 10) },
  });

  log({ type: "done" });
}
