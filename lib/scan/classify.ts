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
const BATCH_SIZE = 4;

const KNOWN_PROCESSORS = new Set([
  "stripe",
  "paypal",
  "square",
  "gumroad",
  "paddle",
  "chargebee",
  "recurly",
  "fastspring",
  "2checkout",
  "braintree",
  "omise",
  "2c2p",
  "xendit",
  "razorpay",
  "klarna",
  "mollie",
  "gocardless",
  "adyen",
  "afterpay",
  "affirm",
  "apple",
  "google",
  "google play",
  "app store",
  "itunes",
]);

const SYSTEM_PROMPT = `You are a billing event classifier. Read each email and extract billing information as a single JSON object.

## Output schema
{
  "is_billing": boolean,
  "event_type": "charge"|"renewal"|"subscription_confirmed"|"failed_payment"|"trial_start"|"trial_ending"|"cancellation"|"other",
  "service_name_raw": "the merchant brand name — NEVER a payment processor name",
  "amount": number or null,
  "currency": "3-letter ISO code (USD, EUR, GBP, etc.) or null",
  "billing_cycle": "monthly"|"annual"|"weekly"|"quarterly"|"one_time"|"unknown",
  "payment_source": "apple"|"google_play"|"direct"|"card_XXXX"|"paypal"|string,
  "trial_ends_at": "YYYY-MM-DD or null",
  "next_renewal_date": "YYYY-MM-DD or null",
  "last_billed_date": "YYYY-MM-DD or null",
  "cancellation_link": "URL or null",
  "category": "entertainment"|"saas"|"health"|"food"|"finance"|"utilities"|"other",
  "confidence": 0.0-1.0,
  "extraction_notes": "optional brief note if you are uncertain"
}

## CRITICAL RULES

### Payment processors
If the sender domain or body shows a PAYMENT PROCESSOR (Stripe, PayPal, Square, Gumroad, Paddle, Chargebee, Recurly, FastSpring, 2Checkout, Braintree, Omise, 2C2P, Xendit, Razorpay, Klarna, Mollie, GoCardless, Adyen, Afterpay, Affirm), you MUST:
- Set service_name_raw to the MERCHANT printed in the email body (the company that sold the product).
- NEVER return the processor name as service_name_raw.
- Look for phrases like "Your receipt from [Merchant]", "Payment to [Merchant]", "charged by [Merchant]".

### Apple App Store receipts
The merchant on the receipt is Apple, but the SERVICE is the app name.
- "YouTube Premium" with merchant Apple → service_name_raw: "YouTube Premium", payment_source: "apple"
- "Duolingo Plus" via Apple → service_name_raw: "Duolingo", payment_source: "apple"
- Do NOT return "Apple", "App Store", or "iTunes" as service_name_raw unless the email is literally about Apple services (iCloud, Apple Music, Apple TV+).

### Google Play receipts
The merchant on the receipt is Google Play, but the SERVICE is the app name.
- "Tinder" via Google Play → service_name_raw: "Tinder", payment_source: "google_play"
- "Spotify" via Google Play → service_name_raw: "Spotify", payment_source: "google_play"
- Do NOT return "Google Play" or "Google" as service_name_raw.

### PayPal merchant-of-record
PayPal emails often say "You sent $X to MERCHANT" or "Receipt for your payment to MERCHANT".
- "You sent $12.99 to Spotify" → service_name_raw: "Spotify", payment_source: "paypal"
- "Receipt for your payment to Netflix" → service_name_raw: "Netflix", payment_source: "paypal"
- Do NOT return "PayPal" as service_name_raw.

### Buy-now-pay-later (Klarna, Afterpay, Affirm)
These are payment-splitting services. The underlying purchase may be a subscription or one-time.
- If the email explicitly says "subscription" or "recurring", set billing_cycle accordingly and is_billing: true.
- If it is an installment plan for a one-time purchase, set billing_cycle: "one_time", is_billing: true, event_type: "charge".
- "Your Klarna payment for Nike" → billing_cycle: "one_time", is_billing: true
- "Affirm: Subscription payment confirmed for Peloton" → billing_cycle: "monthly", is_billing: true
- The processor name (Klarna/Afterpay/Affirm) should NEVER be service_name_raw.

### Embedded checkout (Shopify, Squarespace, Wix)
These platforms power checkout for many small stores.
- Find the STORE NAME in the email body, subject, or header.
- "Your order from Acme Widgets" on Shopify → service_name_raw: "Acme Widgets", payment_source: "direct"
- Do NOT return "Shopify", "Squarespace", or "Wix" as service_name_raw.

### Refund emails
- Refund confirmations → event_type: "other", is_billing: false
- The user did not spend money; they got money back.

### Free tier / downgrade emails
- "Downgraded to free plan" → is_billing: false, event_type: "other"
- "Trial ended — now on free tier" → is_billing: false, event_type: "other"
- No money movement = not a billing event.

### Billing cycle rules
- Set billing_cycle = "one_time" if there is NO renewal language (no "subscription", "renew", "recurring", "monthly", "annual", "weekly", "quarterly", or future renewal date).
- Plain purchase receipts and order confirmations with no subscription language are one_time.
- Set billing_cycle = "unknown" only if billing language exists but the cycle is ambiguous.

### Currency normalization
Always return currency as a 3-letter ISO code:
- "$" or "USD" → "USD"
- "€" or "EUR" → "EUR"
- "£" or "GBP" → "GBP"
- If only a symbol is present, map it to the ISO code. If truly unknown, return null.

### Per-field confidence guidance
Calibrate confidence based on certainty:
- 0.9–1.0: merchant identity is unmistakable, amount and cycle are explicit in the email
- 0.7–0.8: merchant is clear, but one field (amount or cycle) is inferred or missing
- 0.5–0.6: merchant identity is ambiguous (e.g., processor name vs. merchant name), or the email is billing-adjacent
- 0.0–0.4: you are guessing; use only when forced
- Merchant identity confidence should generally be higher than amount confidence, which should be higher than cycle confidence.

### Event types
- "charge" — payment processed (receipt, invoice, order confirmation, "you were charged")
- "renewal" — subscription renewal notice or confirmation
- "subscription_confirmed" — welcome / subscription-active email
- "failed_payment" — payment failed for existing subscription
- "trial_start" — free trial began
- "trial_ending" — trial ends soon, payment pending
- "cancellation" — subscription canceled or expired
- "other" — billing-adjacent but no money movement; set is_billing: false

## Few-shot examples

### 1. Stripe SaaS receipt
Email: "Your receipt from Notion — $10.00 charged to your Visa ending in 4242."
Output:
{"is_billing":true,"event_type":"charge","service_name_raw":"Notion","amount":10.00,"currency":"USD","billing_cycle":"monthly","payment_source":"direct","trial_ends_at":null,"next_renewal_date":null,"last_billed_date":null,"cancellation_link":null,"category":"saas","confidence":0.95}

### 2. PayPal payment to merchant
Email: "You sent $29.99 USD to Spotify Limited. Receipt ID: 1A2B3C."
Output:
{"is_billing":true,"event_type":"charge","service_name_raw":"Spotify","amount":29.99,"currency":"USD","billing_cycle":"monthly","payment_source":"paypal","trial_ends_at":null,"next_renewal_date":null,"last_billed_date":null,"cancellation_link":null,"category":"entertainment","confidence":0.92}

### 3. Apple App Store subscription
Email: "App Store receipt: YouTube Premium $11.99/mo. Billed by Apple."
Output:
{"is_billing":true,"event_type":"charge","service_name_raw":"YouTube Premium","amount":11.99,"currency":"USD","billing_cycle":"monthly","payment_source":"apple","trial_ends_at":null,"next_renewal_date":null,"last_billed_date":null,"cancellation_link":null,"category":"entertainment","confidence":0.94}

### 4. Google Play subscription
Email: "Google Play: Tinder Plus $9.99/month. Order number: GPA.1234-5678."
Output:
{"is_billing":true,"event_type":"charge","service_name_raw":"Tinder","amount":9.99,"currency":"USD","billing_cycle":"monthly","payment_source":"google_play","trial_ends_at":null,"next_renewal_date":null,"last_billed_date":null,"cancellation_link":null,"category":"entertainment","confidence":0.93}

### 5. Amazon order confirmation (one-time)
Email: "Your Amazon.com order of Wireless Mouse has shipped. Total: $24.99."
Output:
{"is_billing":true,"event_type":"charge","service_name_raw":"Amazon","amount":24.99,"currency":"USD","billing_cycle":"one_time","payment_source":"direct","trial_ends_at":null,"next_renewal_date":null,"last_billed_date":null,"cancellation_link":null,"category":"saas","confidence":0.88}

### 6. Shopify store receipt
Email: "Order #1001 confirmed — Acme Widgets. You paid $45.00."
Output:
{"is_billing":true,"event_type":"charge","service_name_raw":"Acme Widgets","amount":45.00,"currency":"USD","billing_cycle":"one_time","payment_source":"direct","trial_ends_at":null,"next_renewal_date":null,"last_billed_date":null,"cancellation_link":null,"category":"other","confidence":0.85}

### 7. Trial start email
Email: "Your free trial of Figma Professional starts today. You will be billed $15/mo after 14 days."
Output:
{"is_billing":true,"event_type":"trial_start","service_name_raw":"Figma","amount":15.00,"currency":"USD","billing_cycle":"monthly","payment_source":"direct","trial_ends_at":null,"next_renewal_date":null,"last_billed_date":null,"cancellation_link":null,"category":"saas","confidence":0.9}

### 8. Cancellation confirmation
Email: "Your Netflix subscription has been canceled. You can watch until Oct 15, 2024."
Output:
{"is_billing":true,"event_type":"cancellation","service_name_raw":"Netflix","amount":null,"currency":null,"billing_cycle":"monthly","payment_source":"direct","trial_ends_at":null,"next_renewal_date":null,"last_billed_date":null,"cancellation_link":null,"category":"entertainment","confidence":0.92}

### 9. Newsletter (not billing)
Email: "This week in AI: new models, new tools, and our top picks."
Output:
{"is_billing":false,"event_type":"other","service_name_raw":null,"amount":null,"currency":null,"billing_cycle":"one_time","payment_source":null,"trial_ends_at":null,"next_renewal_date":null,"last_billed_date":null,"cancellation_link":null,"category":null,"confidence":0.99}

### 10. BNPL installment plan
Email: "Klarna: Payment 2 of 4 for Nike order #KLN-889. Amount due: $22.50."
Output:
{"is_billing":true,"event_type":"charge","service_name_raw":"Nike","amount":22.50,"currency":"USD","billing_cycle":"one_time","payment_source":"klarna","trial_ends_at":null,"next_renewal_date":null,"last_billed_date":null,"cancellation_link":null,"category":"other","confidence":0.82}

Always return valid JSON. Never use markdown fences. Never add comments inside JSON.`;

const BATCH_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

## BATCH INSTRUCTIONS
You will receive multiple emails labeled [EMAIL 1], [EMAIL 2], etc.
Return a JSON object with a "results" array containing EXACTLY N classification objects — one per input email, in the SAME ORDER.
{"results": [{...}, {...}, ...]}

CRITICAL:
- The array length MUST equal the number of input emails. NEVER skip emails. NEVER merge emails.
- If an email is not billing-related, return is_billing:false for that slot.
- Do not add extra fields outside the schema.
- Do not combine multiple emails into a single result.`;

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
  extraction_notes?: string;
}

export interface EmailInput {
  subject: string;
  from: string;
  date: string;
  body: string;
  recipientEmail?: string;
}

const ALLOWED_EVENT_TYPES: Array<ClassifiedEvent["event_type"]> = [
  "charge",
  "renewal",
  "subscription_confirmed",
  "failed_payment",
  "trial_start",
  "trial_ending",
  "cancellation",
  "other",
];

const ALLOWED_BILLING_CYCLES: Array<ClassifiedEvent["billing_cycle"]> = [
  "monthly",
  "annual",
  "weekly",
  "quarterly",
  "one_time",
  "unknown",
];

function isProcessorName(name: unknown): boolean {
  if (typeof name !== "string") return false;
  return KNOWN_PROCESSORS.has(name.trim().toLowerCase());
}

export function sanitizeClassification(raw: unknown): ClassifiedEvent {
  const r = raw as Record<string, unknown>;

  // is_billing
  const isBilling = typeof r?.is_billing === "boolean" ? r.is_billing : false;

  // event_type
  let eventType: ClassifiedEvent["event_type"] = "other";
  if (typeof r?.event_type === "string" && ALLOWED_EVENT_TYPES.includes(r.event_type as ClassifiedEvent["event_type"])) {
    eventType = r.event_type as ClassifiedEvent["event_type"];
  }

  // service_name_raw: NEVER a known processor
  let serviceName: string | undefined = undefined;
  if (typeof r?.service_name_raw === "string" && r.service_name_raw.trim().length > 0) {
    const trimmed = r.service_name_raw.trim();
    if (!isProcessorName(trimmed)) {
      serviceName = trimmed;
    }
  }

  // amount: positive number or null
  let amount: number | null = null;
  if (typeof r?.amount === "number" && Number.isFinite(r.amount) && r.amount > 0) {
    amount = r.amount;
  }

  // currency
  let currency: string | null = null;
  if (typeof r?.currency === "string" && r.currency.trim().length > 0) {
    currency = r.currency.trim().toUpperCase();
  }

  // billing_cycle
  let billingCycle: ClassifiedEvent["billing_cycle"] = "unknown";
  if (
    typeof r?.billing_cycle === "string" &&
    ALLOWED_BILLING_CYCLES.includes(r.billing_cycle as ClassifiedEvent["billing_cycle"])
  ) {
    billingCycle = r.billing_cycle as ClassifiedEvent["billing_cycle"];
  }

  // payment_source
  let paymentSource: string | undefined = undefined;
  if (typeof r?.payment_source === "string" && r.payment_source.trim().length > 0) {
    paymentSource = r.payment_source.trim();
  }

  // dates
  const trialEndsAt = typeof r?.trial_ends_at === "string" ? r.trial_ends_at : null;
  const nextRenewalDate = typeof r?.next_renewal_date === "string" ? r.next_renewal_date : null;
  const lastBilledDate = typeof r?.last_billed_date === "string" ? r.last_billed_date : null;
  const cancellationLink = typeof r?.cancellation_link === "string" ? r.cancellation_link : null;

  // category
  let category: ClassifiedEvent["category"] = undefined;
  const allowedCategories: Array<ClassifiedEvent["category"]> = [
    "entertainment",
    "saas",
    "health",
    "food",
    "finance",
    "utilities",
    "other",
  ];
  if (typeof r?.category === "string" && allowedCategories.includes(r.category as ClassifiedEvent["category"])) {
    category = r.category as ClassifiedEvent["category"];
  }

  // confidence: default to 0.5 if missing or invalid
  let confidence = 0.5;
  if (typeof r?.confidence === "number" && Number.isFinite(r.confidence)) {
    confidence = Math.max(0, Math.min(1, r.confidence));
  }

  // extraction_notes
  let extractionNotes: string | undefined = undefined;
  if (typeof r?.extraction_notes === "string" && r.extraction_notes.trim().length > 0) {
    extractionNotes = r.extraction_notes.trim();
  }

  // Rule: cancellation is still billing
  const finalIsBilling = eventType === "cancellation" ? true : isBilling;

  return {
    is_billing: finalIsBilling,
    event_type: eventType,
    service_name_raw: serviceName,
    amount,
    currency,
    billing_cycle: billingCycle,
    payment_source: paymentSource,
    trial_ends_at: trialEndsAt,
    next_renewal_date: nextRenewalDate,
    last_billed_date: lastBilledDate,
    cancellation_link: cancellationLink,
    category,
    confidence,
    extraction_notes: extractionNotes,
  };
}

export function needsStrongModel(result: ClassifiedEvent): boolean {
  if ((result.confidence ?? 0) < CONFIDENCE_THRESHOLD) return true;
  if (isProcessorName(result.service_name_raw)) return true;
  if (result.billing_cycle === "unknown" && result.event_type === "charge") return true;
  if (result.amount === null && result.billing_cycle !== "one_time") return true;
  return false;
}

function singlePrompt(input: EmailInput): string {
  return `Classify this billing email. Return JSON only.

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
  "confidence": 0.0-1.0,
  "extraction_notes": "optional note"
}
${input.recipientEmail ? `\n(Recipient: ${input.recipientEmail})` : ""}

Subject: ${input.subject}
From: ${input.from}
Date: ${input.date}
Body: ${input.body.slice(0, 8000)}`;
}

function batchPrompt(emails: Array<EmailInput & { id: string }>, recipientEmail: string): string {
  const sections = emails
    .map(
      (e, i) =>
        `[EMAIL ${i + 1}]
Subject: ${e.subject}
From: ${e.from}
Date: ${e.date}
Body: ${e.body.slice(0, 2500)}`
    )
    .join("\n\n---\n\n");
  return `Classify these ${emails.length} billing emails. Return {"results": [...]}, one item per email in order.${
    recipientEmail ? `\n(Recipient for all: ${recipientEmail})` : ""
  }\n\n${sections}`;
}

function validateClassification(raw: unknown): ClassifiedEvent | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const r = raw as Record<string, unknown>;

  // is_billing must be boolean
  if (typeof r.is_billing !== "boolean") {
    return null;
  }

  // event_type must be valid string if present
  if (
    r.event_type !== undefined &&
    (typeof r.event_type !== "string" || !ALLOWED_EVENT_TYPES.includes(r.event_type as ClassifiedEvent["event_type"]))
  ) {
    return null;
  }

  // confidence must be finite number in [0,1] if present
  if (
    r.confidence !== undefined &&
    (typeof r.confidence !== "number" || !Number.isFinite(r.confidence) || r.confidence < 0 || r.confidence > 1)
  ) {
    return null;
  }

  // amount must be positive finite number or null if present
  if (r.amount !== undefined && r.amount !== null && (typeof r.amount !== "number" || !Number.isFinite(r.amount) || r.amount <= 0)) {
    return null;
  }

  // currency must be 3-letter ISO code or null if present
  if (r.currency !== undefined && r.currency !== null) {
    if (typeof r.currency !== "string" || !/^[A-Z]{3}$/i.test(r.currency.trim())) {
      return null;
    }
  }

  // service_name_raw must not be a known processor name
  if (typeof r.service_name_raw === "string" && isProcessorName(r.service_name_raw)) {
    return null;
  }

  // billing_cycle must be valid if present
  if (
    r.billing_cycle !== undefined &&
    (typeof r.billing_cycle !== "string" || !ALLOWED_BILLING_CYCLES.includes(r.billing_cycle as ClassifiedEvent["billing_cycle"]))
  ) {
    return null;
  }

  // Dates and links must be strings or null if present
  for (const key of ["trial_ends_at", "next_renewal_date", "last_billed_date", "cancellation_link"]) {
    const val = r[key];
    if (val !== undefined && val !== null && typeof val !== "string") {
      return null;
    }
  }

  // category must be valid if present
  if (
    r.category !== undefined &&
    (typeof r.category !== "string" || !["entertainment", "saas", "health", "food", "finance", "utilities", "other"].includes(r.category))
  ) {
    return null;
  }

  // extraction_notes must be string if present
  if (r.extraction_notes !== undefined && typeof r.extraction_notes !== "string") {
    return null;
  }

  return sanitizeClassification(r);
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
    const parsed = JSON.parse(content);
    const validated = validateClassification(parsed);
    if (!validated) {
      console.warn("[classify] single validation failed", { subject: input.subject });
      return null;
    }
    return validated;
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
    const parsed = JSON.parse(content);
    const validated = validateClassification(parsed);
    if (!validated) {
      console.warn("[classify] strong validation failed", { subject: input.subject });
      return null;
    }
    return validated;
  } catch (err) {
    console.error("[classify] strong error:", err);
    return null;
  }
}

export async function classifyBatch(
  emails: Array<EmailInput & { id: string }>,
  recipientEmail: string
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
    const parsed = JSON.parse(content) as { results?: unknown[] };
    if (!Array.isArray(parsed.results) || parsed.results.length !== emails.length) {
      throw new Error(`count mismatch: got ${parsed.results?.length ?? 0}, expected ${emails.length}`);
    }

    const validated = parsed.results.map((r, i) => {
      const v = validateClassification(r);
      if (!v) {
        console.warn(`[classify] batch item ${i + 1} validation failed`, { id: emails[i].id });
      }
      return v;
    });

    const allValid = validated.every((v) => v !== null);
    if (!allValid) {
      throw new Error("batch contained invalid classifications");
    }

    return validated.map((v, i) => ({ ...v!, _id: emails[i].id }));
  } catch (err) {
    console.warn("[classify] batch failed, trying strong model fallback:", String(err));

    // Try strong model on each email before falling back to individual fast calls
    const strongResults: Array<ClassifiedEvent & { _id: string }> = [];
    const failedIds = new Set<string>();

    for (const email of emails) {
      const r = await classifyStrong(email);
      if (r) {
        strongResults.push({ ...r, _id: email.id });
      } else {
        failedIds.add(email.id);
      }
      await new Promise((res) => setTimeout(res, 80));
    }

    // For any that still failed, try individual fast model
    for (const email of emails) {
      if (!failedIds.has(email.id)) continue;
      const r = await classifyEmail(email);
      if (r) {
        strongResults.push({ ...r, _id: email.id });
      }
      await new Promise((res) => setTimeout(res, 60));
    }

    // Preserve original order
    const byId = new Map(strongResults.map((r) => [r._id, r]));
    const ordered: Array<ClassifiedEvent & { _id: string }> = [];
    for (const email of emails) {
      const found = byId.get(email.id);
      if (found) ordered.push(found);
    }
    return ordered;
  }
}

export async function classifyClusters(
  userId: string,
  recipientEmail: string,
  onProgress?: (done: number, total: number) => void
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

    // Re-classify items that need the strong model
    const needsStrong = results.filter((r) => needsStrongModel(r));
    for (const r of needsStrong) {
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
