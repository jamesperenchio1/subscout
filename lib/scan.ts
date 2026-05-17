import { gmailClient, listBillingMessageIds, getMessageMetadata, getMessageBody } from "./gmail";
import { shouldProcessEmail } from "./heuristic";
import { extractEvent, type ExtractedEvent } from "./groq";
import { supabaseAdmin } from "./supabase";

const SCAN_DAYS = 365;
const EVENT_CONFIDENCE_THRESHOLD = 0.55;
const CONFIRMED_CONFIDENCE_THRESHOLD = 0.75;
const PER_CALL_DELAY_MS = 100;

export type ScanEvent =
  | { type: "start"; totalFetched: number }
  | { type: "filter"; passed: number; dropped: number }
  | { type: "processing"; current: number; total: number; subject: string; from: string }
  | { type: "event_collected"; service: string; eventType: string; subject: string }
  | { type: "analyzing"; services: number }
  | { type: "found"; service: string; amount: number | null; currency: string | null; cycle: string | null; confidence: number; reason: "recurring" | "confirmed"; occurrences: number }
  | { type: "skipped"; reason: "not_billing" | "low_confidence" | "no_name" | "insufficient_evidence"; subject: string; confidence?: number }
  | { type: "error"; message: string }
  | { type: "done"; found: number; scanned: number };

interface AccountRow {
  id: string;
  user_id: string;
  google_refresh_token: string;
  google_email: string;
}

export interface SourceEmailEntry {
  id: string;
  subject: string;
  from: string;
  date: string;
  event_type: string;
  amount?: number | null;
}

interface CollectedEvent {
  extracted: ExtractedEvent;
  meta: { id: string; subject: string; from: string; date: string };
}

const POSITIVE_EVENT_TYPES = new Set(["charge", "renewal", "subscription_confirmed", "failed_payment"]);

// Map root sender domains to canonical brand names so Anthropic/Claude/Anthropic PBC all group together
const DOMAIN_TO_BRAND: Record<string, string> = {
  "anthropic.com": "Anthropic",
  "apple.com": "Apple",
  "netflix.com": "Netflix",
  "spotify.com": "Spotify",
  "github.com": "GitHub",
  "microsoft.com": "Microsoft",
  "amazon.com": "Amazon",
  "adobe.com": "Adobe",
  "dropbox.com": "Dropbox",
  "notion.so": "Notion",
  "slack.com": "Slack",
  "figma.com": "Figma",
  "linear.app": "Linear",
  "vercel.com": "Vercel",
};

function senderRootDomain(fromHeader: string): string {
  const match = fromHeader.match(/@([\w.-]+)/);
  if (!match) return "";
  const parts = match[1].toLowerCase().split(".");
  return parts.length >= 2 ? parts.slice(-2).join(".") : match[1].toLowerCase();
}

function resolveServiceName(fromHeader: string, extractedName: string): string {
  const domain = senderRootDomain(fromHeader);
  return DOMAIN_TO_BRAND[domain] ?? extractedName;
}

function normalizeServiceKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function parseSourceEmails(raw: string | null | undefined): SourceEmailEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Legacy: single email ID stored as plain string
    return raw.length > 5 ? [{ id: raw, subject: "", from: "", date: "", event_type: "unknown" }] : [];
  }
}

export async function runInitialScan(
  account: AccountRow,
  emit?: (event: ScanEvent) => void,
): Promise<{ found: number; scanned: number }> {
  const log = emit ?? (() => {});
  const db = supabaseAdmin();
  const gmail = gmailClient(account.google_refresh_token);
  const since = new Date(Date.now() - SCAN_DAYS * 24 * 60 * 60 * 1000);

  const ids = await listBillingMessageIds(gmail, since, 500);
  log({ type: "start", totalFetched: ids.length });

  // Stage 2: heuristic filter
  const toProcess: { id: string; subject: string; from: string; date: string; snippet: string }[] = [];
  for (const id of ids) {
    let meta;
    try {
      meta = await getMessageMetadata(gmail, id);
    } catch {
      continue;
    }
    if (shouldProcessEmail(meta.subject, meta.snippet)) {
      toProcess.push(meta);
    }
  }
  log({ type: "filter", passed: toProcess.length, dropped: ids.length - toProcess.length });

  // Stage 3: Groq extraction — accumulate events by resolved service name
  const byService = new Map<string, CollectedEvent[]>();

  for (let i = 0; i < toProcess.length; i++) {
    const meta = toProcess[i];
    log({ type: "processing", current: i + 1, total: toProcess.length, subject: meta.subject, from: meta.from });

    let body = "";
    try {
      body = await getMessageBody(gmail, meta.id);
    } catch {
      body = meta.snippet;
    }

    const extracted = await extractEvent({
      subject: meta.subject,
      from: meta.from,
      date: meta.date,
      body,
      recipientEmail: account.google_email,
    });
    await new Promise((r) => setTimeout(r, PER_CALL_DELAY_MS));

    if (!extracted || !extracted.is_billing) {
      log({ type: "skipped", reason: "not_billing", subject: meta.subject });
      continue;
    }
    if ((extracted.confidence ?? 0) < EVENT_CONFIDENCE_THRESHOLD) {
      log({ type: "skipped", reason: "low_confidence", subject: meta.subject, confidence: extracted.confidence });
      continue;
    }
    if (!extracted.service_name) {
      log({ type: "skipped", reason: "no_name", subject: meta.subject });
      continue;
    }
    if (extracted.event_type === "cancellation" || extracted.event_type === "other") {
      log({ type: "skipped", reason: "not_billing", subject: meta.subject });
      continue;
    }

    // Resolve canonical service name using sender domain, then normalize for grouping key
    const resolvedName = resolveServiceName(meta.from, extracted.service_name);
    extracted.service_name = resolvedName;
    const key = normalizeServiceKey(resolvedName);

    const existing = byService.get(key) ?? [];
    existing.push({ extracted, meta: { id: meta.id, subject: meta.subject, from: meta.from, date: meta.date } });
    byService.set(key, existing);

    log({ type: "event_collected", service: resolvedName, eventType: extracted.event_type ?? "unknown", subject: meta.subject.slice(0, 60) });
  }

  // Stage 4: Trend analysis
  log({ type: "analyzing", services: byService.size });

  let found = 0;

  for (const [, events] of byService) {
    const positiveEvents = events.filter(
      (e) => POSITIVE_EVENT_TYPES.has(e.extracted.event_type ?? "") && (e.extracted.confidence ?? 0) >= EVENT_CONFIDENCE_THRESHOLD,
    );
    const confirmedEvent = events.find(
      (e) => e.extracted.event_type === "subscription_confirmed" && (e.extracted.confidence ?? 0) >= CONFIRMED_CONFIDENCE_THRESHOLD,
    );

    const isRecurring = positiveEvents.length >= 2;
    const isConfirmed = Boolean(confirmedEvent);

    if (!isRecurring && !isConfirmed) {
      const first = events[0];
      log({ type: "skipped", reason: "insufficient_evidence", subject: `${first.extracted.service_name} (${positiveEvents.length} event, need 2+ or a confirmation)` });
      continue;
    }

    // Most recent event for primary details
    const latest = events.reduce((a, b) => {
      const aDate = a.extracted.event_date ?? a.meta.date;
      const bDate = b.extracted.event_date ?? b.meta.date;
      return aDate > bDate ? a : b;
    });
    const { extracted } = latest;
    const serviceName = extracted.service_name!;

    const avgConfidence =
      positiveEvents.reduce((s, e) => s + (e.extracted.confidence ?? 0), 0) / (positiveEvents.length || 1);

    const subStatus = extracted.event_type === "failed_payment" ? "payment_failed" : "active";
    const reason: "recurring" | "confirmed" = isRecurring ? "recurring" : "confirmed";

    // Build source emails list (all contributing events, deduplicated by id)
    const sourceEmails: SourceEmailEntry[] = [];
    const seenIds = new Set<string>();
    for (const ev of events) {
      if (!seenIds.has(ev.meta.id)) {
        seenIds.add(ev.meta.id);
        sourceEmails.push({
          id: ev.meta.id,
          subject: ev.meta.subject,
          from: ev.meta.from,
          date: ev.meta.date,
          event_type: ev.extracted.event_type ?? "unknown",
          amount: ev.extracted.amount ?? null,
        });
      }
    }
    // Sort newest first
    sourceEmails.sort((a, b) => b.date.localeCompare(a.date));

    const { error } = await db.from("subscriptions").upsert(
      {
        user_id: account.user_id,
        connected_account_id: account.id,
        service_name: serviceName,
        amount: extracted.amount ?? null,
        currency: extracted.currency ?? null,
        billing_cycle: extracted.billing_cycle ?? "unknown",
        next_renewal_date: extracted.next_renewal_date || null,
        last_billed_date: extracted.last_billed_date || extracted.event_date || null,
        email_used: account.google_email,
        cancellation_link: extracted.cancellation_link ?? null,
        category: extracted.category ?? "other",
        source_email_id: JSON.stringify(sourceEmails),
        confidence_score: Math.round(avgConfidence * 100) / 100,
        status: subStatus,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,service_name" },
    );

    if (!error) {
      found++;
      log({
        type: "found",
        service: serviceName,
        amount: extracted.amount ?? null,
        currency: extracted.currency ?? null,
        cycle: extracted.billing_cycle ?? null,
        confidence: avgConfidence,
        reason,
        occurrences: positiveEvents.length,
      });
    } else {
      log({ type: "error", message: `DB upsert failed for ${serviceName}: ${error.message}` });
    }
  }

  await db
    .from("connected_accounts")
    .update({
      last_scanned_at: new Date().toISOString(),
      scanned_through_date: since.toISOString().slice(0, 10),
      emails_scanned_count: ids.length,
      subs_found_count: found,
    })
    .eq("id", account.id);

  log({ type: "done", found, scanned: toProcess.length });
  return { found, scanned: toProcess.length };
}
