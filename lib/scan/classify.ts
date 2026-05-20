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

const FAST_MODEL = "llama-3.1-8b-instant";
const STRONG_MODEL = "llama-3.3-70b-versatile";
const CONFIDENCE_THRESHOLD = 0.6;
const BATCH_SIZE = 6;

const SYSTEM_PROMPT = `You are a billing event classifier. Read the email and extract billing information as JSON.

## CRITICAL RULE — Payment processors
If the sender domain or email header shows a PAYMENT PROCESSOR (Stripe, PayPal, Square, Gumroad, Paddle, Chargebee, Recurly, FastSpring, 2Checkout, Braintree, Omise, 2C2P, Xendit, Razorpay, Klarna, Mollie, GoCardless, Adyen), you MUST:
- Set service_name_raw to the MERCHANT printed in the email body (the company that sold the product)
- NEVER return "Stripe", "PayPal", or any processor name as service_name_raw
- Look for phrases like "Your receipt from [Merchant]", "Payment to [Merchant]", "charged by [Merchant]"

## Billing cycle rules
- Set billing_cycle = "one_time" if the email has NO renewal language (no "subscription", "renew", "recurring", "monthly", "annual", "weekly", "quarterly", or future renewal date)
- Plain purchase receipts and order confirmations with no subscription language are one_time
- Set billing_cycle = "unknown" only if billing language exists but cycle is ambiguous

## Event types
- "charge"                  — payment processed (receipt, invoice, order confirmation, "you were charged")
- "renewal"                 — subscription renewal notice or confirmation
- "subscription_confirmed"  — welcome/subscription-active email
- "failed_payment"          — payment failed for existing subscription
- "trial_start"             — free trial began
- "trial_ending"            — trial ends soon, payment pending
- "cancellation"            — subscription canceled or expired
- "other"                   — billing-adjacent but no money movement; set is_billing: false

## Payment source
- "apple"       — Apple App Store / iTunes
- "google_play" — Google Play Store
- "direct"      — billed directly by the service
- "card_XXXX"   — if a card last-4 is visible (e.g. "card_4532")

## Confidence
Set confidence < 0.5 if you are uncertain about merchant identity or billing cycle.

Always return valid JSON. Never use markdown fences.`;

const BATCH_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

You will receive multiple emails labeled [EMAIL 1], [EMAIL 2], etc.
Return a JSON object with a "results" array of EXACTLY N items (one per email, in the same order):
{"results": [{classification}, {classification}, ...]}
The array length MUST equal the number of input emails. Never skip or merge emails.`;

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

export interface EmailInput {
  subject: string;
  from: string;
  date: string;
  body: string;
  recipientEmail?: string;
}

function singlePrompt(input: EmailInput): string {
  return `Classify this billing email. Return JSON only.

EXAMPLES:
- Stripe receipt "Your receipt from Anthropic" → service_name_raw: "Anthropic", NOT "Stripe"
- PayPal "You sent $9.99 to Netflix" → service_name_raw: "Netflix", NOT "PayPal"
- Amazon order confirmation (no subscription mention) → billing_cycle: "one_time"
- "Your Claude Pro subscription renews Jun 1 for $20/mo" → service_name_raw: "Anthropic", billing_cycle: "monthly"

{
  "is_billing": true,
  "event_type": "charge|renewal|subscription_confirmed|failed_payment|trial_start|trial_ending|cancellation|other",
  "service_name_raw": "merchant brand name — NEVER a payment processor",
  "amount": number or null,
  "currency": "ISO code",
  "billing_cycle": "monthly|annual|weekly|quarterly|one_time|unknown",
  "payment_source": "apple|google_play|direct|card_XXXX",
  "trial_ends_at": "YYYY-MM-DD or null",
  "next_renewal_date": "YYYY-MM-DD or null",
  "last_billed_date": "YYYY-MM-DD or null",
  "cancellation_link": "URL or null",
  "category": "entertainment|saas|health|food|finance|utilities|other",
  "confidence": 0.0-1.0
}
${input.recipientEmail ? `\n(Recipient: ${input.recipientEmail})` : ""}

Subject: ${input.subject}
From: ${input.from}
Date: ${input.date}
Body: ${input.body.slice(0, 8000)}`;
}

function batchPrompt(emails: Array<EmailInput & { id: string }>, recipientEmail: string): string {
  const sections = emails.map((e, i) =>
    `[EMAIL ${i + 1}]
Subject: ${e.subject}
From: ${e.from}
Date: ${e.date}
Body: ${e.body.slice(0, 1500)}`
  ).join("\n\n---\n\n");
  return `Classify these ${emails.length} billing emails. Return {"results": [...]}, one item per email in order.${recipientEmail ? `\n(Recipient for all: ${recipientEmail})` : ""}\n\n${sections}`;
}

export async function classifyEmail(input: EmailInput): Promise<ClassifiedEvent | null> {
  try {
    const res = await client().chat.completions.create({
      model: FAST_MODEL,
      temperature: 0,
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: singlePrompt(input) },
      ],
    });
    const content = res.choices[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content) as ClassifiedEvent;
  } catch (err) {
    console.error("[classify] single error:", err);
    return null;
  }
}

async function classifyStrong(input: EmailInput): Promise<ClassifiedEvent | null> {
  try {
    const res = await client().chat.completions.create({
      model: STRONG_MODEL,
      temperature: 0,
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: singlePrompt(input) },
      ],
    });
    const content = res.choices[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content) as ClassifiedEvent;
  } catch (err) {
    console.error("[classify] strong error:", err);
    return null;
  }
}

export async function classifyBatch(
  emails: Array<EmailInput & { id: string }>,
  recipientEmail: string,
): Promise<Array<ClassifiedEvent & { _id: string }>> {
  try {
    const res = await client().chat.completions.create({
      model: FAST_MODEL,
      temperature: 0,
      max_tokens: emails.length * 350,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: BATCH_SYSTEM_PROMPT },
        { role: "user", content: batchPrompt(emails, recipientEmail) },
      ],
    });
    const content = res.choices[0]?.message?.content;
    if (!content) throw new Error("empty response");
    const parsed = JSON.parse(content) as { results?: ClassifiedEvent[] };
    if (!Array.isArray(parsed.results) || parsed.results.length !== emails.length) {
      throw new Error(`count mismatch: got ${parsed.results?.length ?? 0}, expected ${emails.length}`);
    }
    return parsed.results.map((r, i) => ({ ...r, _id: emails[i].id }));
  } catch (err) {
    console.warn("[classify] batch failed, falling back to individual:", String(err));
    const results: Array<ClassifiedEvent & { _id: string }> = [];
    for (const email of emails) {
      const r = await classifyEmail(email);
      if (r) results.push({ ...r, _id: email.id });
      await new Promise((res) => setTimeout(res, 60));
    }
    return results;
  }
}

export async function classifyClusters(
  userId: string,
  recipientEmail: string,
  onProgress?: (done: number, total: number) => void,
): Promise<{ classified: number }> {
  const db = supabaseAdmin();

  const { data: events, error } = await db
    .from("email_events")
    .select("id, subject, sender_email, sent_at, raw_extract, rule_verdict")
    .eq("user_id", userId)
    .is("event_type", null);
  if (error) throw error;
  if (!events?.length) return { classified: 0 };

  const toClassify = events.filter((ev) => {
    const rv = (ev as { rule_verdict?: string | null }).rule_verdict;
    const hasBody = !!(ev.raw_extract as { body?: string } | null)?.body;
    return hasBody && (rv === "needs_llm" || rv === null);
  });

  const total = toClassify.length;
  let done = 0;
  let classified = 0;

  for (let i = 0; i < toClassify.length; i += BATCH_SIZE) {
    const batch = toClassify.slice(i, i + BATCH_SIZE);
    const inputs = batch.map((ev) => ({
      id: ev.id,
      subject: ev.subject ?? "",
      from: ev.sender_email ?? "",
      date: ev.sent_at ?? "",
      body: (ev.raw_extract as { body?: string }).body!,
    }));

    let results = await classifyBatch(inputs, recipientEmail);

    // Re-classify low-confidence items with the strong model
    const lowConf = results.filter((r) => (r.confidence ?? 1) < CONFIDENCE_THRESHOLD);
    for (const r of lowConf) {
      const ev = batch.find((e) => e.id === r._id);
      if (!ev) continue;
      const strong = await classifyStrong({
        subject: ev.subject ?? "",
        from: ev.sender_email ?? "",
        date: ev.sent_at ?? "",
        body: (ev.raw_extract as { body?: string }).body!,
        recipientEmail,
      });
      if (strong) {
        results = results.map((x) => (x._id === r._id ? { ...strong, _id: r._id } : x));
      }
    }

    for (const result of results) {
      const ev = batch.find((e) => e.id === result._id);
      if (!ev) continue;
      const { error: updateErr } = await db
        .from("email_events")
        .update({
          event_type: result.event_type ?? "other",
          service_name_raw: result.service_name_raw ?? null,
          amount: result.amount ?? null,
          currency: result.currency ?? null,
          payment_source: result.payment_source ?? "direct",
          confidence: result.confidence ?? null,
          raw_extract: { ...((ev.raw_extract as object) ?? {}), classified: result },
        })
        .eq("id", ev.id);
      if (!updateErr) classified++;
    }

    done += batch.length;
    onProgress?.(done, total);

    if (i + BATCH_SIZE < toClassify.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return { classified };
}
