import { supabaseAdmin } from "@/lib/supabase";
import { resolveBrand } from "./enrich";

interface EventRow {
  id: string;
  cluster_id: string | null;
  event_type: string | null;
  service_brand: string | null;
  amount: number | null;
  currency: string | null;
  payment_source: string | null;
  sent_at: string | null;
  confidence: number | null;
  raw_extract: Record<string, unknown> | null;
}

const POSITIVE_EVENT_TYPES = new Set([
  "charge",
  "renewal",
  "subscription_confirmed",
  "failed_payment",
]);
const DAY_MS = 86_400_000;

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function detectCycle(positiveDates: number[]): {
  cycle: "weekly" | "monthly" | "quarterly" | "annual" | "unknown";
  cycleDays: number | null;
} {
  if (positiveDates.length < 2) return { cycle: "unknown", cycleDays: null };
  const sorted = [...positiveDates].sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) gaps.push((sorted[i] - sorted[i - 1]) / DAY_MS);
  const m = median(gaps);
  if (m < 10) return { cycle: "weekly", cycleDays: 7 };
  if (m < 50) return { cycle: "monthly", cycleDays: 30 };
  if (m < 120) return { cycle: "quarterly", cycleDays: 90 };
  if (m < 500) return { cycle: "annual", cycleDays: 365 };
  return { cycle: "unknown", cycleDays: null };
}

interface DetectResult {
  confirmed: number;
  possible: number;
  canceled: number;
  trial: number;
}

/**
 * Trend detection: group all positive email_events by (service_brand, payment_source).
 * Apply 2+ matching charges => confirmed; 1 => possible; 3 missed cycles => canceled.
 * Upserts subscriptions and links subscription_evidence rows.
 */
export async function detectSubscriptions(userId: string): Promise<DetectResult> {
  const db = supabaseAdmin();

  // Fetch all events for user with required fields
  const { data: events, error } = await db
    .from("email_events")
    .select(
      "id, cluster_id, event_type, service_brand, amount, currency, payment_source, sent_at, confidence, raw_extract, sender_domain, service_name_raw",
    )
    .eq("user_id", userId);
  if (error) throw error;

  const eventsArray = (events ?? []) as (EventRow & {
    sender_domain: string | null;
    service_name_raw: string | null;
  })[];

  // Group by (service_brand, payment_source)
  const groups = new Map<string, typeof eventsArray>();
  for (const ev of eventsArray) {
    const brand = ev.service_brand ?? ev.service_name_raw ?? ev.sender_domain ?? "Unknown";
    const source = ev.payment_source ?? "direct";
    const key = `${brand}::${source}`;
    const arr = groups.get(key) ?? [];
    arr.push(ev);
    groups.set(key, arr);
  }

  const result: DetectResult = { confirmed: 0, possible: 0, canceled: 0, trial: 0 };

  for (const [key, groupEvents] of groups) {
    const [brand, paymentSource] = key.split("::");
    if (!brand || brand === "Unknown") continue;

    const positives = groupEvents.filter(
      (e) => POSITIVE_EVENT_TYPES.has(e.event_type ?? ""),
    );
    const cancellation = groupEvents.find((e) => e.event_type === "cancellation");
    const trial = groupEvents.find(
      (e) => e.event_type === "trial_start" || e.event_type === "trial_ending",
    );

    if (positives.length === 0 && !trial) continue;

    // Determine cycle from positive event dates
    const positiveDates = positives
      .map((e) => (e.sent_at ? new Date(e.sent_at).getTime() : NaN))
      .filter((n) => !Number.isNaN(n));
    const { cycle, cycleDays } = detectCycle(positiveDates);

    // Pick latest event for representative amount/currency
    const latest = [...groupEvents].sort((a, b) => {
      const ad = a.sent_at ? new Date(a.sent_at).getTime() : 0;
      const bd = b.sent_at ? new Date(b.sent_at).getTime() : 0;
      return bd - ad;
    })[0];

    const amount =
      positives.find((e) => e.amount && e.amount > 0)?.amount ?? latest.amount ?? null;
    const currency =
      positives.find((e) => e.currency)?.currency ?? latest.currency ?? null;

    // Compute status
    let status: "active" | "possible" | "canceled" | "trial" | "payment_failed";
    let evidenceStrength: "confirmed" | "possible" | "manual";

    if (cancellation && positives.length < 2) {
      status = "canceled";
      evidenceStrength = positives.length >= 1 ? "confirmed" : "possible";
    } else if (trial && positives.length === 0) {
      status = "trial";
      evidenceStrength = "possible";
    } else if (positives.length >= 2) {
      // Check for missed cycles → canceled
      const lastDate = Math.max(...positiveDates);
      const now = Date.now();
      const missedCycles = cycleDays ? (now - lastDate) / DAY_MS / cycleDays : 0;
      if (missedCycles >= 3) {
        status = "canceled";
      } else if (latest.event_type === "failed_payment") {
        status = "payment_failed";
      } else {
        status = "active";
      }
      evidenceStrength = "confirmed";
    } else {
      status = "possible";
      evidenceStrength = "possible";
    }

    // Brand enrichment (logo + category)
    const brandInfo = await resolveBrand(latest.sender_domain ?? "", brand);

    // Compute next renewal estimate if cycle known and active/trial
    let nextRenewal: string | null = null;
    if ((status === "active" || status === "payment_failed") && cycleDays && positiveDates.length) {
      const lastDate = Math.max(...positiveDates);
      const next = new Date(lastDate + cycleDays * DAY_MS);
      nextRenewal = next.toISOString().slice(0, 10);
    }
    const trialEndsAt = (trial?.raw_extract as { classified?: { trial_ends_at?: string } } | null)
      ?.classified?.trial_ends_at ?? null;

    // Upsert subscription
    const { data: upserted, error: upsertErr } = await db
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          service_brand: brandInfo.brand_name,
          payment_source: paymentSource,
          amount,
          currency,
          billing_cycle: cycle,
          next_renewal_date: nextRenewal,
          last_charge_date: positiveDates.length
            ? new Date(Math.max(...positiveDates)).toISOString().slice(0, 10)
            : null,
          trial_ends_at: trialEndsAt,
          status,
          evidence_strength: evidenceStrength,
          category: brandInfo.category,
          brand_logo_url: brandInfo.logo_url,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,service_brand,payment_source" },
      )
      .select("id")
      .maybeSingle();

    if (upsertErr || !upserted) continue;

    // Replace evidence links
    await db.from("subscription_evidence").delete().eq("subscription_id", upserted.id);
    const evidenceRows = groupEvents.map((ev) => ({
      subscription_id: upserted.id,
      email_event_id: ev.id,
    }));
    if (evidenceRows.length) {
      await db.from("subscription_evidence").insert(evidenceRows);
    }

    if (status === "active" || status === "payment_failed") result.confirmed++;
    else if (status === "possible") result.possible++;
    else if (status === "canceled") result.canceled++;
    else if (status === "trial") result.trial++;
  }

  return result;
}
