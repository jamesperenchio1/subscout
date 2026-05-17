const CURRENCY = /(\$|฿|€|£|¥|USD|THB|EUR|GBP|SGD|AUD)/i;
const AMOUNT   = /\b\d{1,4}[.,]\d{2}\b/;
const BILLING  = /receipt|invoice|charged|billing|renewal|subscription|payment|plan|renewed|auto.?renew|order confirmation|payment received|payment successful|thank you for your purchase|your .* plan|you've been charged|welcome to|thank you for subscribing|your .* subscription|subscription confirmed|you are now subscribed|successfully subscribed|membership/i;

// Pass if ANY signal is present — we cast wide and let Groq + trend analysis do the real filtering.
export function shouldProcessEmail(subject: string, snippet: string): boolean {
  const text = `${subject} ${snippet}`;
  return BILLING.test(text) || (CURRENCY.test(text) && AMOUNT.test(text));
}
