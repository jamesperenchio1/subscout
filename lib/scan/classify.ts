import Groq from "groq-sdk";
import { supabaseAdmin } from "@/lib/supabase";

let _client: Groq | null = null;
function client(): Groq {
  if (_client) return _client;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY missing");
  _client = new Groq({ apiKey });
  return _client;
}

const SYSTEM_PROMPT = `You are a billing event classifier. Read the email and decide what billing event it represents.

Classify event_type as one of:
- "charge"               — payment was successfully processed (receipt, "you were charged", invoice, order confirmation)
- "renewal"              — subscription renewal notice or confirmation
- "subscription_confirmed" — explicit welcome/subscription-active email
- "failed_payment"       — payment attempt failed for an existing subscription
- "trial_start"          — free trial began
- "trial_ending"         — trial ends within next N days, payment pending
- "cancellation"         — subscription canceled or expired
- "other"                — billing-adjacent (marketing, pricing announcements, account tips) — return is_billing: false

For payment_source, infer from context:
- "apple"      — Apple App Store / iTunes / Apple Subscription
- "google_play"— Google Play Store
- "direct"     — billed directly by the service
- "card_XXXX"  — if a card last-4 is visible (e.g. "card_4532")

Always valid JSON. Never markdown.`;

export interface ClassifiedEvent {
  is_billing: boolean;
  event_type?: "charge" | "renewal" | "subscription_confirmed" | "failed_payment" | "trial_start" | "trial_ending" | "cancellation" | "other";
  service_name_raw?: string;
  amount?: number | null;
  currency?: string | null;
  billing_cycle?: "monthly" | "annual" | "weekly" | "quarterly" | "one_time" | "unknown";
  payment_source?: string;
  trial_ends_at?: string | null;
  next_renewal_date?: string | null;
  last_billed_date?: string | null;
  cancellation_link?: string | null;
  category?: "entertainment" | "saas" | "health" | "food" | "finance" | "utilities" | "other";
  confidence?: number;
}

export async function classifyEmail(input: {
  subject: string;
  from: string;
  date: string;
  body: string;
  recipientEmail?: string;
}): Promise<ClassifiedEvent | null> {
  const userPrompt = `Classify this email.
Return JSON:
{
  "is_billing": true,
  "event_type": "charge|renewal|subscription_confirmed|failed_payment|trial_start|trial_ending|cancellation|other",
  "service_name_raw": "brand name (e.g. 'Netflix', 'Claude') — never plan tier",
  "amount": number or null,
  "currency": "ISO code, infer if not explicit",
  "billing_cycle": "monthly|annual|weekly|quarterly|one_time|unknown",
  "payment_source": "apple|google_play|direct|card_XXXX",
  "trial_ends_at": "YYYY-MM-DD or null",
  "next_renewal_date": "YYYY-MM-DD or null",
  "last_billed_date": "YYYY-MM-DD or null",
  "cancellation_link": "URL or null",
  "category": "entertainment|saas|health|food|finance|utilities|other",
  "confidence": 0-1
}

${input.recipientEmail ? `(Recipient: ${input.recipientEmail})` : ""}

Subject: ${input.subject}
From: ${input.from}
Date: ${input.date}
Body: ${input.body.slice(0, 5000)}`;

  try {
    const res = await client().chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0,
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });
    const content = res.choices[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content) as ClassifiedEvent;
  } catch (err) {
    console.error("Groq classify error", err);
    return null;
  }
}

/**
 * For each cluster of unclassified email_events for this user, pick the longest-body
 * representative email, send to Groq, then apply the result to every event in the cluster.
 */
export async function classifyClusters(
  userId: string,
  recipientEmail: string,
  onProgress?: (done: number, total: number) => void,
): Promise<{ classified: number }> {
  const db = supabaseAdmin();

  // Find clusters with at least one event missing event_type
  const { data: events, error } = await db
    .from("email_events")
    .select("id, cluster_id, subject, sender_email, sent_at, raw_extract, event_type")
    .eq("user_id", userId)
    .not("cluster_id", "is", null);
  if (error) throw error;
  if (!events?.length) return { classified: 0 };

  // Group by cluster
  const byCluster = new Map<string, typeof events>();
  for (const ev of events) {
    const arr = byCluster.get(ev.cluster_id!) ?? [];
    arr.push(ev);
    byCluster.set(ev.cluster_id!, arr);
  }

  // For clusters that already have all events classified, skip
  const clusters = Array.from(byCluster.entries()).filter(
    ([, evs]) => evs.some((e) => !e.event_type),
  );

  let classified = 0;
  let done = 0;
  for (const [clusterId, clusterEvents] of clusters) {
    // Need full raw body — we stored it in raw_extract.body for this purpose? We didn't.
    // Refetch the longest representative email's body from raw_extract or skip.
    // For now we re-pull via a helper: caller provides body via raw_extract field.
    // Pick longest-subject as rep (proxy for richest email).
    const rep = clusterEvents.reduce((a, b) =>
      (a.subject?.length ?? 0) >= (b.subject?.length ?? 0) ? a : b,
    );

    const repBody = (rep.raw_extract as { body?: string } | null)?.body ?? "";
    const result = await classifyEmail({
      subject: rep.subject ?? "",
      from: rep.sender_email ?? "",
      date: rep.sent_at ?? "",
      body: repBody,
      recipientEmail,
    });
    await new Promise((r) => setTimeout(r, 100));

    if (!result) {
      done++;
      onProgress?.(done, clusters.length);
      continue;
    }

    // Apply to all events in cluster
    const update = {
      event_type: result.event_type ?? "other",
      service_name_raw: result.service_name_raw ?? null,
      amount: result.amount ?? null,
      currency: result.currency ?? null,
      payment_source: result.payment_source ?? "direct",
      confidence: result.confidence ?? null,
      raw_extract: { ...((rep.raw_extract as object) ?? {}), classified: result },
    };
    const { error: updateErr } = await db
      .from("email_events")
      .update(update)
      .eq("cluster_id", clusterId)
      .eq("user_id", userId);
    if (!updateErr) classified += clusterEvents.length;

    done++;
    onProgress?.(done, clusters.length);
  }

  return { classified };
}
