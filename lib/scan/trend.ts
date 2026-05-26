import { supabaseAdmin } from "@/lib/supabase";
import { resolveBrand } from "./enrich";
import { normalizeBrandName, lookupByDomain, isProcessor } from "./brands";

interface EventRow {
  id: string;
  event_type: string | null;
  service_brand: string | null;
  amount: number | null;
  currency: string | null;
  payment_source: string | null;
  sent_at: string | null;
  confidence: number | null;
  raw_extract: Record<string, unknown> | null;
  sender_domain: string | null;
  service_name_raw: string | null;
  subject?: string | null;
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
  const sorted = [...positiveDates].sort((a, b) => a - b);
  // Fallback for new subscriptions with only 2 receipts
  if (sorted.length === 2) {
    const gap = (sorted[1] - sorted[0]) / DAY_MS;
    if (gap >= 25 && gap <= 35) return { cycle: "monthly", cycleDays: 30 };
    if (gap >= 85 && gap <= 95) return { cycle: "quarterly", cycleDays: 90 };
    if (gap >= 360 && gap <= 370) return { cycle: "annual", cycleDays: 365 };
  }
  // Require at least 3 samples for reliable gap-based detection
  if (positiveDates.length < 3) return { cycle: "unknown", cycleDays: null };
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
  // Fall back to gap-based detection (needs ≥2 samples with fallback, ≥3 otherwise)
  return detectCycleFromGaps(positiveDates);
}

/* ── Semantic brand clustering (local only) ─────────────────────────────── */

function normalizeForClustering(raw: string): string {
  let brand = normalizeBrandName(raw);

  // Strip tier suffixes
  brand = brand.replace(/\s+(Premium|Pro|Plus|Ultimate|Basic|Free|Trial)$/i, "").trim();

  // Strip marketplace / processor prefixes
  brand = brand.replace(/^(App Store|Google Play|via PayPal)\s*/i, "").trim();

  // Common aliases
  const aliases: Record<string, string> = {
    chatgpt: "OpenAI",
    claude: "Anthropic",
  };
  const key = brand.toLowerCase();
  if (aliases[key]) brand = aliases[key];

  return brand;
}

function getClusterBrand(ev: EventRow): string {
  const raw = ev.service_brand ?? ev.service_name_raw ?? ev.sender_domain ?? "Unknown";
  const domainRecord = ev.sender_domain ? lookupByDomain(ev.sender_domain) : null;
  const base = domainRecord?.brand ?? normalizeBrandName(raw);
  return normalizeForClustering(base);
}

/* ── Grouping key with multi-merchant processor support ─────────────────── */

function getGroupBrand(ev: EventRow): string {
  const domain = ev.sender_domain;
  if (domain && isProcessor(domain) && ev.service_name_raw) {
    return normalizeForClustering(ev.service_name_raw);
  }
  return getClusterBrand(ev);
}

function getGroupKey(ev: EventRow): string {
  const brand = getGroupBrand(ev);
  const source = ev.payment_source ?? "direct";
  return `${brand}::${source}`;
}

/* ── Cross-verification helpers ─────────────────────────────────────────── */

function computeEmailFrequencyScore(
  allEvents: EventRow[],
  senderDomain: string | null,
  cycleDays: number | null,
): number {
  if (!senderDomain) return 0;
  const cutoff = Date.now() - 90 * DAY_MS;
  const count = allEvents.filter((e) => {
    if (!e.sent_at) return false;
    const t = new Date(e.sent_at).getTime();
    return t >= cutoff && e.sender_domain === senderDomain;
  }).length;
  const expected = cycleDays ? 90 / cycleDays : 3; // default to monthly expectation
  return Math.min(count / expected, 2); // cap contribution at 2
}

function hasAmountMatchAcrossHistory(
  brand: string,
  allEvents: EventRow[],
): boolean {
  const positiveAmounts = allEvents
    .filter((e) => {
      if (!POSITIVE_EVENT_TYPES.has(e.event_type ?? "")) return false;
      return getClusterBrand(e) === brand && e.amount != null && e.amount > 0;
    })
    .map((e) => e.amount as number);

  if (positiveAmounts.length < 2) return false;

  for (let i = 0; i < positiveAmounts.length; i++) {
    for (let j = i + 1; j < positiveAmounts.length; j++) {
      const a = positiveAmounts[i];
      const b = positiveAmounts[j];
      if (Math.abs(a - b) / Math.max(a, b) <= 0.01) return true;
    }
  }
  return false;
}

function hasHighAmountVariation(groupPositives: EventRow[]): boolean {
  const sorted = [...groupPositives]
    .filter((e) => e.amount != null && e.amount > 0)
    .sort((a, b) => {
      const ad = a.sent_at ? new Date(a.sent_at).getTime() : 0;
      const bd = b.sent_at ? new Date(b.sent_at).getTime() : 0;
      return ad - bd;
    });
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].amount as number;
    const curr = sorted[i].amount as number;
    if (Math.abs(prev - curr) / Math.max(prev, curr) > 0.5) return true;
  }
  return false;
}

function amountsWithinTolerance(positives: EventRow[], tolerance: number): boolean {
  const amounts = positives
    .map((e) => e.amount)
    .filter((a): a is number => a != null && a > 0);
  if (amounts.length < 2) return false;
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  if (max === 0) return false;
  return (max - min) / max <= tolerance;
}

function hasRegularGaps(positives: EventRow[]): boolean {
  const dates = positives
    .map((e) => (e.sent_at ? new Date(e.sent_at).getTime() : NaN))
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b);
  if (dates.length < 3) return false;
  const gaps: number[] = [];
  for (let i = 1; i < dates.length; i++) gaps.push((dates[i] - dates[i - 1]) / DAY_MS);
  const m = median(gaps);
  if (m === 0) return false;
  return gaps.every((g) => Math.abs(g - m) / m <= 0.2);
}

function getSubject(ev: EventRow): string | null {
  if (ev.subject) return ev.subject;
  const raw = ev.raw_extract;
  if (!raw) return null;
  if (typeof raw.subject === "string") return raw.subject;
  const classified = raw.classified as Record<string, unknown> | undefined;
  if (typeof classified?.subject === "string") return classified.subject;
  return null;
}

function hasSubjectPatternMatch(positives: EventRow[]): boolean {
  const subjects = positives.map(getSubject).filter((s): s is string => !!s);
  if (subjects.length < 2) return false;
  const counts = new Map<string, number>();
  for (const s of subjects) counts.set(s, (counts.get(s) ?? 0) + 1);
  return [...counts.values()].some((c) => c >= 2);
}

function computeDomainBrandMatchBonus(
  senderDomain: string | null,
  serviceNameRaw: string | null,
): number {
  if (!senderDomain || !serviceNameRaw) return 0;
  const domainRecord = lookupByDomain(senderDomain);
  if (domainRecord?.kind !== "subscription") return 0;
  if (domainRecord.brand.toLowerCase() === normalizeBrandName(serviceNameRaw).toLowerCase()) {
    return 2;
  }
  return 0;
}

function computeDetectionScore(
  positives: EventRow[],
  cycle: BillingCycle,
  senderDomain: string | null,
  allEvents: EventRow[],
  brand: string,
): number {
  let score = 0;

  // Event type weights
  for (const ev of positives) {
    if (ev.event_type === "renewal" || ev.event_type === "subscription_confirmed") score += 3;
    else if (ev.event_type === "failed_payment") score += 2;
    else if (ev.event_type === "charge") score += 1;
  }

  // Recurring cycle detected (not ambiguous)
  if (cycle !== "unknown") score += 2;

  // Known subscription domain in brand canon
  const domainRecord = senderDomain ? lookupByDomain(senderDomain) : null;
  if (domainRecord?.kind === "subscription") score += 2;

  // Consistent charge amounts — exact match within group
  const positiveAmounts = positives
    .map((e) => e.amount)
    .filter((a): a is number => a != null && a > 0);
  if (positiveAmounts.length >= 2) {
    const uniqueCents = new Set(positiveAmounts.map((a) => Math.round(a * 100)));
    if (uniqueCents.size === 1) {
      score += 3;
    } else if (amountsWithinTolerance(positives, 0.05)) {
      score += 2;
    }
  }

  // Cross-history amount consistency (within 1% tolerance)
  if (hasAmountMatchAcrossHistory(brand, allEvents)) {
    score += 2;
  }

  // Frequency analysis: regular gaps (3+ emails within ±20% of median gap)
  if (hasRegularGaps(positives)) {
    score += 3;
  }

  // Frequency analysis: repeated subject pattern (2+ exact matches)
  if (hasSubjectPatternMatch(positives)) {
    score += 2;
  }

  // Domain-brand resolution bonus
  const representativeServiceName = positives.find((e) => e.service_name_raw)?.service_name_raw ?? null;
  score += computeDomainBrandMatchBonus(senderDomain, representativeServiceName);

  return score;
}

function calibratedConfidence(score: number, positives: number, cycleKnown: boolean): number {
  // Sigmoid-like mapping centered around a score of 6
  const sigmoid = 1 / (1 + Math.exp(-(score - 6) / 2.5));
  const evidenceBoost = Math.min(positives / 10, 0.15);
  const cycleBoost = cycleKnown ? 0.1 : 0;
  const raw = sigmoid + evidenceBoost + cycleBoost;
  return Math.min(Math.max(raw, 0), 1);
}

/* ── Public types ───────────────────────────────────────────────────────── */

export interface DetectResult {
  confirmed: number;
  possible: number;
  canceled: number;
  trial: number;
}

/**
 * Trend detection: group all positive email_events by clustered brand + payment_source.
 * Cross-verification layer adds email-frequency scoring, amount consistency across the
 * full user history, calibrated confidence, and improved lifecycle state handling.
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
    .select("id, service_brand, payment_source, user_overrides")
    .eq("user_id", userId);
  const existingSubsMap = new Map<string, Record<string, unknown>>();
  const existingSubIds = new Set<string>();
  for (const s of existingSubs ?? []) {
    const overrides = s.user_overrides as Record<string, unknown> | null;
    if (overrides && Object.keys(overrides).length > 0) {
      existingSubsMap.set(`${s.service_brand}::${s.payment_source}`, overrides);
    }
    if (s.id) existingSubIds.add(s.id);
  }

  // Pre-fetch latest user_corrections per subscription so corrections persist across rescans
  let correctionsMap = new Map<string, Record<string, unknown>>();
  try {
    const { data: corrections } = await db
      .from("user_corrections")
      .select("subscription_id, corrected_brand, corrected_amount, corrected_currency, corrected_cycle, corrected_category, corrected_status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    for (const c of corrections ?? []) {
      const sid = c.subscription_id as string;
      if (correctionsMap.has(sid)) continue; // keep most recent
      correctionsMap.set(sid, {
        ...(c.corrected_brand ? { brand_name: c.corrected_brand } : {}),
        ...(c.corrected_amount != null ? { amount: c.corrected_amount } : {}),
        ...(c.corrected_currency ? { currency: c.corrected_currency } : {}),
        ...(c.corrected_cycle ? { billing_cycle: c.corrected_cycle } : {}),
        ...(c.corrected_category ? { category: c.corrected_category } : {}),
        ...(c.corrected_status ? { status: c.corrected_status } : {}),
      });
    }
  } catch { /* table may not exist yet */ }

  // Fetch all events for user with required fields
  const { data: events, error } = await db
    .from("email_events")
    .select(
      "id, event_type, service_brand, amount, currency, payment_source, sent_at, confidence, raw_extract, sender_domain, service_name_raw, subject",
    )
    .eq("user_id", userId);
  if (error) throw error;

  const eventsArray = (events ?? []) as EventRow[];

  // Group by (clustered_brand, payment_source) with processor multi-merchant split
  const groups = new Map<string, EventRow[]>();
  for (const ev of eventsArray) {
    const key = getGroupKey(ev);
    const arr = groups.get(key) ?? [];
    arr.push(ev);
    groups.set(key, arr);
  }

  const result: DetectResult = { confirmed: 0, possible: 0, canceled: 0, trial: 0 };

  for (const [key, groupEvents] of groups) {
    const parts = key.split("::");
    let brand = parts[0];
    const paymentSource = parts[1];
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

    // Determine cycle: prefer classifier votes, fall back to gap-based
    const positiveDates = positives
      .map((e) => (e.sent_at ? new Date(e.sent_at).getTime() : NaN))
      .filter((n) => !Number.isNaN(n));
    const { cycle, cycleDays } = detectCycle(positiveDates, classifiedCycles);

    // Pick latest event for representative amount/currency and lifecycle checks
    const latest = [...groupEvents].sort((a, b) => {
      const ad = a.sent_at ? new Date(a.sent_at).getTime() : 0;
      const bd = b.sent_at ? new Date(b.sent_at).getTime() : 0;
      return bd - ad;
    })[0];

    const amount =
      positives.find((e) => e.amount && e.amount > 0)?.amount ?? latest.amount ?? null;
    const currency =
      positives.find((e) => e.currency)?.currency ?? latest.currency ?? null;

    // Detection score + cross-verification bonuses
    let detectionScore = computeDetectionScore(
      positives,
      cycle,
      latest.sender_domain ?? null,
      eventsArray,
      brand,
    );
    const emailFreqScore = computeEmailFrequencyScore(
      eventsArray,
      latest.sender_domain ?? null,
      cycleDays,
    );
    detectionScore += emailFreqScore;

    // Lifecycle helpers
    const latestDate = latest.sent_at ? new Date(latest.sent_at).getTime() : 0;
    const latestPositiveDate = positiveDates.length ? Math.max(...positiveDates) : 0;
    const daysSincePositive = latestPositiveDate
      ? (Date.now() - latestPositiveDate) / DAY_MS
      : Infinity;
    const hasRecentCharge = positiveDates.some(
      (d) => Math.abs(d - latestDate) <= 7 * DAY_MS,
    );
    const hasSubscriptionConfirmed = positives.some(
      (e) => e.event_type === "subscription_confirmed",
    );

    // Determine status using improved lifecycle rules
    let status: "active" | "possible" | "canceled" | "trial" | "payment_failed";
    let evidenceStrength: "confirmed" | "possible" | "manual";

    const missedCycles =
      cycleDays && latestPositiveDate
        ? (Date.now() - latestPositiveDate) / DAY_MS / cycleDays
        : 0;

    if (latest.event_type === "cancellation" && daysSincePositive > (cycleDays ? cycleDays * 2 : 60)) {
      // Latest event is cancellation and no charge within last 2 cycles
      status = "canceled";
      evidenceStrength = detectionScore >= 2 ? "confirmed" : "possible";
    } else if (latest.event_type === "trial_start" && positives.length === 0) {
      // Trial-only, no charges yet
      status = "trial";
      evidenceStrength = "possible";
    } else if (detectionScore >= 4) {
      // Strong evidence — apply lifecycle downgrade rules before confirming active
      if (latest.event_type === "failed_payment" && daysSincePositive <= 30) {
        status = "payment_failed";
        evidenceStrength = "confirmed";
      } else if (missedCycles > 3) {
        status = "canceled";
        evidenceStrength = "confirmed";
      } else if (cycle === "monthly" && daysSincePositive > 90) {
        // Stale monthly subscription — downgrade to possible
        status = "possible";
        evidenceStrength = "possible";
      } else if (missedCycles >= 3) {
        status = "possible";
        evidenceStrength = "possible";
      } else {
        status = "active";
        evidenceStrength = "confirmed";
      }
    } else if (detectionScore >= 2) {
      // Weak evidence — surface as possible
      status = "possible";
      evidenceStrength = "possible";
    } else {
      // score < 2 and no cancellation/trial context → not confident enough to show
      continue;
    }

    // Confidence calibration
    const calibratedConfidenceValue = calibratedConfidence(
      detectionScore,
      positives.length,
      cycle !== "unknown",
    );

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
          detection_score: detectionScore,
          confidence_score: calibratedConfidenceValue,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,service_brand,payment_source" },
      )
      .select("id")
      .maybeSingle();

    if (upsertErr || !upserted) continue;

    // Apply latest user_corrections first so corrections persist across rescans
    const correction = correctionsMap.get(upserted.id);
    if (correction && Object.keys(correction).length > 0) {
      const correctionUpdate: Record<string, unknown> = {};
      if (correction.brand_name) correctionUpdate.service_brand = correction.brand_name;
      if (correction.billing_cycle) correctionUpdate.billing_cycle = correction.billing_cycle;
      if (correction.amount != null) correctionUpdate.amount = correction.amount;
      if (correction.currency) correctionUpdate.currency = correction.currency;
      if (correction.category) correctionUpdate.category = correction.category;
      if (correction.status) correctionUpdate.status = correction.status;
      if (Object.keys(correctionUpdate).length > 0) {
        await db.from("subscriptions").update(correctionUpdate).eq("id", upserted.id);
      }
    }

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

    // Flag low-confidence subscriptions for user review
    if (calibratedConfidenceValue < 0.6 || detectionScore < 3) {
      try {
        await db.from("review_queue").upsert({
          user_id: userId,
          subscription_id: upserted.id,
          reason: "low_confidence",
          resolved: false,
        }, { onConflict: "user_id,subscription_id" });
      } catch { /* table may not exist yet */ }
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
