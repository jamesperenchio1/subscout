import { lookupByDomain } from "./brands";

export type RuleVerdict = "known_sub" | "known_retailer_oneoff" | "needs_llm" | "skip";

export interface RuleInput {
  subject: string;
  senderDomain: string;
  snippet: string;
  body: string;
}

// Definitive billing signals — if any match, this email has money movement
const BILLING_SIGNAL =
  /receipt|invoice|you.?(?:were|have been|'ve been)\s+charged|payment\s+(?:received|successful|processed|confirmed)|order\s+confirmation|thank.?you\s+for\s+(?:your\s+)?(?:purchase|order|subscribing|your\s+subscription)|billing\s+statement|amount\s+(?:due|paid|charged)|auto.?renewed?|renewal\s+(?:notice|confirmation)|subscription\s+(?:renewed?|confirmed?|activated?|started?)|next\s+(?:billing|charge|renewal)\s+date|paid|ใบเสร็จ|ใบกำกับภาษี|ชำระ(?:เงิน|แล้ว)|เรียกเก็บ|ต่ออายุ|สมัครสมาชิก|ค่าบริการ/i;

// Recurring-specific language — distinguishes annual Amazon Prime from a one-off order
const RECURRING_SIGNAL =
  /subscri(?:ption|be|bing)|renew(?:al|ed|ing|s)|recurring|monthly|annually|annual\s+plan|weekly\s+plan|quarterly|membership|auto.?(?:pay|renew|charge|bill)|your\s+plan|billing\s+cycle|next\s+(?:charge|payment)\s+on|will\s+be\s+charged\s+(?:again|monthly|annually)/i;

// Skip: security/account management emails that slipped through the heuristic
const SKIP_SUBJECT =
  /verify\s+(?:your\s+)?(?:email|account|identity)|confirm\s+(?:your\s+)?(?:email|account)|account\s+(?:created|verified|activated)|welcome\s+to\b(?!.{0,60}(?:subscription|plan|member|paid|premium))|reset\s+your\s+password|your\s+(?:login|sign.?in)\s+(?:code|link)|two.factor|2fa\s+code|otp\s+code|new\s+device\s+sign.?in|sign.?in\s+from\s+new/i;

// Skip: pure marketing — promotional language with no billing signal
const MARKETING_SIGNAL =
  /\b(?:\d+%\s*off|sale\s+ends|limited\s+time\s+offer|flash\s+sale|special\s+offer|promo\s+code|coupon|deal\s+of\s+the\s+day|black\s+friday|cyber\s+monday)\b/i;

// Skip: newsletter/content footers
const NEWSLETTER_SIGNAL =
  /unsubscribe\s+from\s+(?:this\s+)?(?:email|list|newsletter)|email\s+preferences|manage\s+(?:your\s+)?(?:email\s+)?preferences|view\s+(?:this\s+)?(?:email\s+)?in\s+(?:your\s+)?browser|you(?:'re|\s+are)\s+receiving\s+this\s+(?:email|message)\s+because/i;

export function applyRules(input: RuleInput): RuleVerdict {
  const { subject, senderDomain, snippet, body } = input;
  const text = `${subject} ${snippet}`;
  const fullText = `${subject} ${snippet} ${body.slice(0, 3000)}`;

  // ── 1. Hard skip: security / account management ──────────────────────────
  if (SKIP_SUBJECT.test(subject)) return "skip";

  // ── 2. Hard skip: newsletter with no billing signal ──────────────────────
  if (NEWSLETTER_SIGNAL.test(body.slice(0, 2000)) && !BILLING_SIGNAL.test(text)) return "skip";

  // ── 3. Hard skip: marketing promo without billing signal ─────────────────
  if (MARKETING_SIGNAL.test(subject) && !BILLING_SIGNAL.test(fullText)) return "skip";

  const record = lookupByDomain(senderDomain);
  const hasBillingSignal = BILLING_SIGNAL.test(fullText);
  const hasRecurringSignal = RECURRING_SIGNAL.test(fullText);

  // ── 4. Processor domain: always need LLM to find the actual merchant ─────
  if (record?.kind === "processor") {
    return hasBillingSignal ? "needs_llm" : "skip";
  }

  // ── 5. Known subscription service ────────────────────────────────────────
  if (record?.kind === "subscription") {
    return hasBillingSignal ? "known_sub" : "skip";
  }

  // ── 6. Known retailer ────────────────────────────────────────────────────
  if (record?.kind === "retailer") {
    if (!hasBillingSignal) return "skip";
    // Retailers with recurring language (Prime, Shopee Coins, etc.) need LLM
    return hasRecurringSignal ? "needs_llm" : "known_retailer_oneoff";
  }

  // ── 7. Unknown domain — send to LLM if billing-shaped ────────────────────
  return hasBillingSignal ? "needs_llm" : "skip";
}
