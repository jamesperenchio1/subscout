import Groq from "groq-sdk";

let _client: Groq | null = null;
function client(): Groq {
  if (_client) return _client;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY missing");
  _client = new Groq({ apiKey });
  return _client;
}

const SYSTEM_PROMPT = `You are a billing event classifier. Read the full email and extract exactly what happened.

Classify event_type as:
- "charge"                — a payment was successfully processed (receipt, "you were charged", "payment received", order confirmation)
- "renewal"               — a subscription renewal notice or upcoming renewal reminder
- "subscription_confirmed"— email explicitly confirms an active subscription: "welcome to", "thank you for subscribing", "your subscription is active/confirmed", "you're now subscribed", subscription start/upgrade confirmation
- "failed_payment"        — a payment attempt failed but the subscription still exists
- "cancellation"          — the subscription was canceled or expired
- "other"                 — billing-adjacent but none of the above (marketing, pricing announcements, account tips, etc.)

Return { "is_billing": false } ONLY if the email has nothing to do with a real payment or subscription lifecycle event — e.g. pure marketing, cold outreach, newsletters, plan pricing announcements with no personal subscription context.

For all other billing-related emails, return full JSON. Always return valid JSON, never markdown.`;

export interface ExtractedEvent {
  is_billing: boolean;
  service_name?: string;
  amount?: number | null;
  currency?: string | null;
  billing_cycle?: "monthly" | "annual" | "weekly" | "one_time" | "unknown";
  event_type?: "charge" | "subscription_confirmed" | "renewal" | "failed_payment" | "cancellation" | "other";
  event_date?: string | null;
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

export async function extractEvent(email: EmailInput): Promise<ExtractedEvent | null> {
  const userPrompt = `Classify this billing email and extract event data.
Return JSON with these fields:
{
  "is_billing": true,
  "service_name": "canonical company name — use brand name, NOT plan tier (e.g. 'Netflix', 'Claude', 'Spotify', 'GitHub' — never 'Netflix Premium' or 'Claude Max')",
  "amount": number or null,
  "currency": "ISO 4217 code, infer from context",
  "billing_cycle": "monthly | annual | weekly | one_time | unknown",
  "event_type": "charge | subscription_confirmed | renewal | failed_payment | cancellation | other",
  "event_date": "YYYY-MM-DD — the date this event occurred",
  "next_renewal_date": "YYYY-MM-DD or null",
  "last_billed_date": "YYYY-MM-DD or null",
  "cancellation_link": "full URL or null",
  "category": "entertainment | saas | health | food | finance | utilities | other",
  "confidence": number 0-1
}

${email.recipientEmail ? `The recipient email address is: ${email.recipientEmail} — use this exactly for any email_used context.` : ""}

Subject: ${email.subject}
From: ${email.from}
Date: ${email.date}
Body: ${email.body.slice(0, 2500)}`;

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
    return JSON.parse(content) as ExtractedEvent;
  } catch (err) {
    console.error("Groq extract error", err);
    return null;
  }
}
