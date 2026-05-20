import { gmailClient, listBillingMessageIds, getFullMessage, getMessageMetadata, parseSender, downloadAttachment, type FullMessage, type MessageHeaders } from "@/lib/gmail";
import { parsePdfBuffer } from "./pdf-parser";
import { shouldProcessEmail } from "@/lib/heuristic";
import { supabaseAdmin } from "@/lib/supabase";
import { applyRules } from "./rules";
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

  // ── 2b. Full-body pass — fetch, parse PDFs, and insert filtered emails ─
  console.log(`[scan] stage 2b: full-body fetch for ${filteredIds.length} emails`);
  t = Date.now();
  let ingested = 0;
  let pdfParsed = 0;
  let pdfImageOnly = 0;
  const PDF_SIZE_LIMIT = 5 * 1024 * 1024; // 5 MB

  for (const id of filteredIds) {
    let full: FullMessage;
    try {
      full = await getFullMessage(gmail, id, 10000);
    } catch (err) {
      console.warn(`[scan] full-body fetch failed for ${id}:`, String(err));
      continue;
    }

    const { email: senderEmail, domain: senderDomain } = parseSender(full.from);
    const sentAt = full.internalDate ? new Date(full.internalDate).toISOString() : null;

    // Parse PDF attachments (skip oversized ones)
    let body = full.body;
    let pdfParseStatus: string | null = null;
    const pdfMeta: { filename: string; sizeBytes: number; status: string }[] = [];

    for (const att of full.pdfAttachments) {
      if (att.sizeBytes > PDF_SIZE_LIMIT) {
        pdfMeta.push({ filename: att.filename, sizeBytes: att.sizeBytes, status: "too_large" });
        continue;
      }
      try {
        const buf = await downloadAttachment(gmail, id, att.attachmentId);
        const parsed = await parsePdfBuffer(buf);
        if (parsed.isImageOnly) {
          pdfMeta.push({ filename: att.filename, sizeBytes: att.sizeBytes, status: "image_only" });
          if (!pdfParseStatus || pdfParseStatus === "image_only") {
            pdfParseStatus = "image_only";
          }
          pdfImageOnly++;
        } else {
          pdfMeta.push({ filename: att.filename, sizeBytes: att.sizeBytes, status: "parsed" });
          // Prepend PDF text so classifier sees it first
          body = `[PDF: ${att.filename}]\n${parsed.text}\n\n---\n${body}`;
          pdfParseStatus = "parsed";
          pdfParsed++;
        }
      } catch (pdfErr) {
        console.warn(`[scan] PDF parse failed for attachment ${att.filename} in ${id}:`, String(pdfErr));
        pdfMeta.push({ filename: att.filename, sizeBytes: att.sizeBytes, status: "error" });
      }
    }

    // Rules engine — runs after we have the full body
    const verdict = applyRules({
      subject: full.subject ?? "",
      senderDomain,
      snippet: full.snippet ?? "",
      body,
    });
    if (verdict === "skip") continue;

    const rawExtract: Record<string, unknown> = {
      body,
      snippet: full.snippet,
      rule_verdict: verdict,
    };
    if (pdfMeta.length > 0) rawExtract.pdf_attachments = pdfMeta;

    const { error: insertErr } = await db.from("email_events").insert({
      user_id: account.user_id,
      gmail_account_id: account.id,
      gmail_message_id: id,
      subject: full.subject,
      sender_email: senderEmail,
      sender_domain: senderDomain,
      sent_at: sentAt,
      raw_extract: rawExtract,
      rule_verdict: verdict,
      ...(pdfParseStatus ? { pdf_parse_status: pdfParseStatus } : {}),
    });
    if (insertErr) {
      console.warn(`[scan] insert failed for ${id}:`, insertErr.message);
    } else {
      ingested++;
    }
  }
  console.log(`[scan] stage 2b done: ${ingested} ingested, ${pdfParsed} PDFs parsed, ${pdfImageOnly} image-only (${elapsed(t)})`);
  log({ type: "stage", stage: "ingest", message: `${ingested} emails ingested (${pdfParsed > 0 ? `${pdfParsed} PDFs parsed` : ""}${pdfImageOnly > 0 ? `, ${pdfImageOnly} image-only PDFs` : ""}) (${elapsed(t)})` });

  // Update watermark
  const scannedThroughDate = since.toISOString().slice(0, 10);
  await db
    .from("gmail_accounts")
    .update({ scanned_through_date: scannedThroughDate })
    .eq("id", account.id);

  // ── 3. Classify ─────────────────────────────────────────────────────────
  log({ type: "stage", stage: "classify", message: "Classifying emails with Groq…" });
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
