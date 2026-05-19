import { supabaseAdmin } from "@/lib/supabase";
import { resolveBrand } from "./enrich";
import { NAME_CANONICAL } from "./brand-aliases";

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

type BillingCycle = "weekly" | "monthly" | "quarterly" | "annual" | "unknown";

function detectCycleFromGaps(positiveDates: number[]): {
  cycle: BillingCycle;
  cycleDays: number | null;
} {
  // Require at least 3 samples for reliable gap-based detection
  if (positiveDates.length < 3) return { cycle: "unknown", cycleDays: null };
  const sorted = [...positiveDates].sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) gaps.push((sorted[i] - sorted[i - 1]) / DAY_MS);
  const m = median(gaps);
  if (m < 8) return { cycle: "weekly", cycleDays: 7 };
  if (m < 50) return { cycle: "monthly", cycleDays: 30 };
  if (m < 120) return { cycle: "quarterly", cycleDays: 90 };
  if (m < 500) return { cycle: "annual", cycleDays: 365 };
  return { cycle: "unknown", cycleDays: null };
}

function cycleToDays(cycle: BillingCycle): number | null {
  if (cycle === "weekly") return 7;
  if (cycle === "monthly") return 30;
  if (cycle === "quarterly") return 90;
  if (cycle === "annual") return 365;
  return null;
}

function detectCycle(
  positiveDates: number[],
  classifiedCycles: (string | null | undefined)[],
): { cycle: BillingCycle; cycleDays: number | null } {
  // Prefer majority vote from classifier-extracted cycles
  const validCycles = classifiedCycles.filter(
    (c): c is BillingCycle =>
      c === "weekly" || c === "monthly" || c === "quarterly" || c === "annual",
  );
  if (validCycles.length >= 2) {
    const counts = new Map<BillingCycle, number>();
    for (const c of validCycles) counts.set(c, (counts.get(c) ?? 0) + 1);
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] >= 2) {
      return { cycle: best[0], cycleDays: cycleToDays(best[0]) };
    }
  }
  if (validCycles.length === 1) {
    return { cycle: validCycles[0], cycleDays: cycleToDays(validCycles[0]) };
  }
  // Fall back to gap-based detection (needs ≥3 samples)
  return detectCycleFromGaps(positiveDates);
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

  // Pre-fetch dismissed patterns (graceful if table doesn't exist yet)
  let dismissedPatterns: { service_brand: string | null; payment_source: string | null; reason: string; canonical_brand: string | null }[] = [];
  try {
    const { data } = await db
      .from("dismissed_patterns")
      .select("service_brand, payment_source, reason, canonical_brand")
      .eq("user_id", userId);
    dismissedPatterns = data ?? [];
  } catch { /* table may not exist yet */ }

  // Pre-fetch existing subscriptions to preserve user_overrides across rescans
  const { data: existingSubs } = await db
    .from("subscriptions")
    .select("service_brand, payment_source, user_overrides")
    .eq("user_id", userId);
  const existingSubsMap = new Map<string, Record<string, unknown>>();
  for (const s of existingSubs ?? []) {
    const overrides = s.user_overrides as Record<string, unknown> | null;
    if (overrides && Object.keys(overrides).length > 0) {
      existingSubsMap.set(`${s.service_brand}::${s.payment_source}`, overrides);
    }
  }

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

  // Group by (normalized_brand, payment_source)
  const groups = new Map<string, typeof eventsArray>();
  for (const ev of eventsArray) {
    const rawBrand = ev.service_brand ?? ev.service_name_raw ?? ev.sender_domain ?? "Unknown";
    // Normalize via alias table (e.g. "Claude" → "Anthropic")
    const brand = NAME_CANONICAL[rawBrand.toLowerCase()] ?? rawBrand;
    const source = ev.payment_source ?? "direct";
    const key = `${brand}::${source}`;
    const arr = groups.get(key) ?? [];
    arr.push(ev);
    groups.set(key, arr);
  }

  const result: DetectResult = { confirmed: 0, possible: 0, canceled: 0, trial: 0 };

  for (const [key, groupEvents] of groups) {
    let [brand, paymentSource] = key.split("::");
    if (!brand || brand === "Unknown") continue;

    // Check dismissed patterns — skip or rename as appropriate
    const dismissMatch = dismissedPatterns.find(
      (p) => p.service_brand === brand && p.payment_source === paymentSource,
    );
    if (dismissMatch && dismissMatch.reason !== "wrong_merchant") continue;
    if (dismissMatch?.reason === "wrong_merchant" && dismissMatch.canonical_brand) {
      brand = dismissMatch.canonical_brand;
    }

    const positives = groupEvents.filter(
      (e) => POSITIVE_EVENT_TYPES.has(e.event_type ?? ""),
    );
    const cancellation = groupEvents.find((e) => e.event_type === "cancellation");
    const trial = groupEvents.find(
      (e) => e.event_type === "trial_start" || e.event_type === "trial_ending",
    );

    if (positives.length === 0 && !trial) continue;

    // Skip groups where all positives are one-time purchases
    const classifiedCycles = positives.map(
      (e) =>
        (e.raw_extract?.classified as { billing_cycle?: string } | undefined)?.billing_cycle ??
        null,
    );
    const allOneTime =
      positives.length > 0 &&
      classifiedCycles.every((c) => c === "one_time");
    if (allOneTime) continue;

    // Determine cycle: prefer classifier votes, fall back to gap-based (needs ≥3 samples)
    const positiveDates = positives
      .map((e) => (e.sent_at ? new Date(e.sent_at).getTime() : NaN))
      .filter((n) => !Number.isNaN(n));
    const { cycle, cycleDays } = detectCycle(positiveDates, classifiedCycles);

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

    // Re-apply user_overrides so user edits survive rescans
    const overrideKey = `${brandInfo.brand_name}::${paymentSource}`;
    const overrides = existingSubsMap.get(overrideKey);
    if (overrides && Object.keys(overrides).length > 0) {
      const overrideUpdate: Record<string, unknown> = {};
      if (overrides.brand_name) overrideUpdate.service_brand = overrides.brand_name;
      if (overrides.billing_cycle) overrideUpdate.billing_cycle = overrides.billing_cycle;
      if (overrides.amount != null) overrideUpdate.amount = overrides.amount;
      if (overrides.currency) overrideUpdate.currency = overrides.currency;
      if (overrides.category) overrideUpdate.category = overrides.category;
      if (overrides.status) overrideUpdate.status = overrides.status;
      if (overrides.next_renewal_date) overrideUpdate.next_renewal_date = overrides.next_renewal_date;
      if (Object.keys(overrideUpdate).length > 0) {
        await db.from("subscriptions").update(overrideUpdate).eq("id", upserted.id);
      }
    }

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
