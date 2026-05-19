import { gmailClient, listBillingMessageIds, getFullMessage, getMessageMetadata, parseSender, type FullMessage, type MessageHeaders } from "@/lib/gmail";
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
  | { type: "progress"; current: number; total: number; filtered?: number; stage: string }
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

  const elapsed = (start: number) => `${((Date.now() - start) / 1000).toFixed(1)}s`;

  // ── 1. Fetch Gmail message IDs ──────────────────────────────────────────
  log({ type: "stage", stage: "gmail", message: "Searching Gmail for billing emails…" });
  console.log("[scan] stage 1: searching Gmail");
  let t = Date.now();
  const ids = await listBillingMessageIds(gmail, since, 500);
  console.log(`[scan] stage 1 done: ${ids.length} ids (${elapsed(t)})`);
  log({ type: "stage", stage: "gmail", message: `Found ${ids.length} candidate emails (${elapsed(t)})` });

  // Skip messages already ingested
  const { data: existingRows, error: existingErr } = await db
    .from("email_events")
    .select("gmail_message_id")
    .eq("user_id", account.user_id)
    .eq("gmail_account_id", account.id);
  if (existingErr) {
    console.error("[scan] failed to fetch existing rows:", existingErr.message);
    log({ type: "stage", stage: "filter", message: `Warning: could not load existing emails — ${existingErr.message}` });
  }
  const existing = new Set((existingRows ?? []).map((r) => r.gmail_message_id));
  const newIds = ids.filter((id) => !existing.has(id));
  console.log(`[scan] ${newIds.length} new ids, ${ids.length - newIds.length} already ingested`);
  log({ type: "stage", stage: "filter", message: `${newIds.length} new emails to process (${ids.length - newIds.length} already seen)` });

  // ── 2a. Metadata pass — heuristic filter on subject + snippet only ─────
  console.log(`[scan] stage 2a: metadata pass over ${newIds.length} emails`);
  t = Date.now();
  let metaProcessed = 0;
  const filteredIds: string[] = [];
  for (const id of newIds) {
    let meta: MessageHeaders;
    try {
      meta = await getMessageMetadata(gmail, id);
    } catch (err) {
      console.warn(`[scan] metadata fetch failed for ${id}:`, String(err));
      metaProcessed++;
      log({ type: "progress", current: metaProcessed, total: newIds.length, stage: "ingest" });
      continue;
    }
    metaProcessed++;
    log({ type: "progress", current: metaProcessed, total: newIds.length, stage: "ingest" });
    if (shouldProcessEmail(meta.subject, meta.snippet)) {
      filteredIds.push(id);
    }
  }
  console.log(`[scan] stage 2a done: ${filteredIds.length}/${newIds.length} passed heuristic (${elapsed(t)})`);
  log({ type: "stage", stage: "filter", message: `${filteredIds.length} of ${newIds.length} passed heuristic filter (${elapsed(t)})` });
  log({ type: "progress", current: newIds.length, total: newIds.length, filtered: filteredIds.length, stage: "ingest" });

  // ── 2b. Full-body pass — embed and insert filtered emails only ──────────
  console.log(`[scan] stage 2b: full-body fetch + embed for ${filteredIds.length} emails`);
  t = Date.now();
  let ingested = 0;
  for (const id of filteredIds) {
    let full: FullMessage;
    try {
      full = await getFullMessage(gmail, id, 5000);
    } catch (err) {
      console.warn(`[scan] full-body fetch failed for ${id}:`, String(err));
      continue;
    }

    const { email: senderEmail, domain: senderDomain } = parseSender(full.from);
    const sentAt = full.internalDate ? new Date(full.internalDate).toISOString() : null;

    const embeddingText = `${full.subject ?? ""}\n${full.body.slice(0, 800)}`.replace(/\s+/g, " ").trim().slice(0, 2000);
    let embeddingVec: string | null = null;
    try {
      const vec = await embed(embeddingText);
      embeddingVec = toPgVector(vec);
    } catch (err) {
      console.warn(`[scan] embed failed for ${id}:`, String(err));
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
    if (insertErr) {
      console.warn(`[scan] insert failed for ${id}:`, insertErr.message);
    } else {
      ingested++;
    }
  }
  console.log(`[scan] stage 2b done: ${ingested} ingested (${elapsed(t)})`);
  log({ type: "stage", stage: "ingest", message: `${ingested} emails ingested (${elapsed(t)})` });

  // Update watermark
  const scannedThroughDate = since.toISOString().slice(0, 10);
  await db
    .from("gmail_accounts")
    .update({ scanned_through_date: scannedThroughDate })
    .eq("id", account.id);

  // ── 3. Cluster ──────────────────────────────────────────────────────────
  log({ type: "stage", stage: "cluster", message: "Clustering similar emails…" });
  console.log("[scan] stage 3: clustering");
  t = Date.now();
  const clusterRes = await clusterPendingEvents(account.user_id);
  console.log(`[scan] stage 3 done: ${clusterRes.assigned} events in ${clusterRes.clusters} clusters (${elapsed(t)})`);
  log({ type: "stage", stage: "cluster", message: `${clusterRes.assigned} events grouped into ${clusterRes.clusters} clusters (${elapsed(t)})` });

  // ── 4. Classify ─────────────────────────────────────────────────────────
  log({ type: "stage", stage: "classify", message: "Classifying clusters with Groq…" });
  console.log("[scan] stage 4: Groq classification");
  t = Date.now();
  await classifyClusters(account.user_id, account.google_email, (done, total) => {
    log({ type: "progress", current: done, total, stage: "classify" });
  });
  console.log(`[scan] stage 4 done (${elapsed(t)})`);
  log({ type: "stage", stage: "classify", message: `Classification complete (${elapsed(t)})` });

  // ── 5. Enrich ───────────────────────────────────────────────────────────
  log({ type: "stage", stage: "enrich", message: "Resolving brand names and logos…" });
  console.log("[scan] stage 5: enrichment");
  t = Date.now();
  await enrichUnresolvedEvents(account.user_id);
  console.log(`[scan] stage 5 done (${elapsed(t)})`);
  log({ type: "stage", stage: "enrich", message: `Brand enrichment complete (${elapsed(t)})` });

  // ── 6. Trend detection ──────────────────────────────────────────────────
  log({ type: "stage", stage: "trend", message: "Detecting recurring patterns…" });
  console.log("[scan] stage 6: trend detection");
  t = Date.now();
  const result = await detectSubscriptions(account.user_id);
  console.log(`[scan] stage 6 done: confirmed=${result.confirmed} possible=${result.possible} canceled=${result.canceled} trial=${result.trial} (${elapsed(t)})`);
  log({ type: "stage", stage: "trend", message: `Trend detection complete (${elapsed(t)})` });

  log({
    type: "summary",
    confirmed: result.confirmed,
    possible: result.possible,
    canceled: result.canceled,
    trial: result.trial,
  });

  log({ type: "done" });
}
