import { google, type gmail_v1 } from "googleapis";
import { decrypt } from "./crypto";
import { THAI_BILLING_TERMS } from "./thailand";

// 12 specialized queries — each targets a distinct billing/subscription signal.
// We run every query against Gmail and deduplicate message IDs downstream,
// so overlap across categories is harmless and ensures wide coverage.
const BILLING_QUERIES = [
  // Q1: core receipt / payment / order keywords in subject
  `subject:(receipt OR invoice OR "payment successful" OR "payment received" OR "payment processed" OR "payment confirmation" OR "you've been charged" OR "order confirmation" OR "billing statement" OR "amount due" OR "amount paid")`,
  // Q2: renewal / subscription lifecycle keywords in subject
  `subject:(renewal OR renew OR subscription OR subscribe OR "your plan" OR "auto-renew" OR "trial ending" OR "free trial" OR "next billing" OR "next charge" OR cancellation OR canceled OR cancelled)`,
  // Q3: billing-specific sender address patterns
  `from:(billing OR invoice OR receipts OR payments OR receipt OR stripe OR paypal OR chargebee OR paddle OR recurly OR fastspring OR gumroad OR woocommerce)`,
  // Q4: App store receipts
  `from:(apple.com OR google.com OR play.google.com) subject:(receipt OR invoice OR subscription OR "your receipt" OR "payment receipt" OR "you paid" OR charged OR billing)`,
  // Q5: PayPal specifically
  `from:(paypal.com OR pay pal) subject:(receipt OR payment OR invoice OR "you sent" OR "money sent" OR "subscription payment")`,
  // Q6: Stripe receipts
  `from:(stripe.com OR "via stripe") subject:(receipt OR "your receipt" OR invoice)`,
  // Q7: Trial-related
  `subject:("free trial" OR "trial started" OR "trial ending" OR "trial ends" OR "trial period" OR "trial reminder" OR "confirm your trial" OR "start your free trial")`,
  // Q8: Cancellation / refund
  `subject:(cancellation OR canceled OR cancelled OR "subscription canceled" OR "membership canceled" OR refund OR "subscription ended" OR "plan ended")`,
  // Q9: Price increase / plan change
  `subject:("price increase" OR "price change" OR "plan change" OR "subscription change" OR "update to your plan" OR "new pricing" OR "billing update")`,
  // Q10: Domain-based catch-all for known processors
  `from:(chargebee.com OR paddle.com OR recurly.com OR fastspring.com OR 2checkout.com OR braintree.com OR adyen.com OR klarna.com OR mollie.com OR gocardless.com OR razorpay.com OR xendit.com)`,
  // Q11: Generic amount + currency signals
  `subject:($ OR € OR £ OR ¥ OR USD OR EUR OR GBP) (subscription OR monthly OR annual OR billed OR charged)`,
  // Q12: Thai / SEA billing terms
  `subject:(${THAI_BILLING_TERMS.map((t) => `"${t}"`).join(" OR ")})`,
];

const MAX_PER_QUERY = 2000;

async function fetchQueryIds(
  gmail: gmail_v1.Gmail,
  q: string,
  after: number,
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined = undefined;
  while (ids.length < MAX_PER_QUERY) {
    const res = await gmail.users.messages.list({
      userId: "me",
      q: `${q} after:${after}`,
      maxResults: Math.min(500, MAX_PER_QUERY - ids.length),
      fields: "messages(id),nextPageToken",
      pageToken,
    });
    const data = res.data as gmail_v1.Schema$ListMessagesResponse;
    for (const m of data.messages ?? []) if (m.id) ids.push(m.id);
    pageToken = data.nextPageToken ?? undefined;
    if (!pageToken) break;
  }
  return ids;
}

export function gmailClient(encryptedRefreshToken: string): gmail_v1.Gmail {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  oauth2.setCredentials({ refresh_token: decrypt(encryptedRefreshToken) });
  return google.gmail({ version: "v1", auth: oauth2 });
}

export async function listBillingMessageIds(
  gmail: gmail_v1.Gmail,
  sinceDate: Date,
  maxResults = 5000,
): Promise<string[]> {
  const after = Math.floor(sinceDate.getTime() / 1000);
  const seen = new Set<string>();
  const ids: string[] = [];

  for (const q of BILLING_QUERIES) {
    const queryIds = await fetchQueryIds(gmail, q, after);
    for (const id of queryIds) {
      if (!seen.has(id) && ids.length < maxResults) {
        seen.add(id);
        ids.push(id);
      }
    }
    if (ids.length >= maxResults) break;
  }

  return ids;
}

export interface MessageHeaders {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}

function headerValue(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export async function getMessageMetadata(gmail: gmail_v1.Gmail, id: string): Promise<MessageHeaders> {
  const res = await gmail.users.messages.get({
    userId: "me",
    id,
    format: "metadata",
    metadataHeaders: ["Subject", "From", "Date"],
  });
  const headers = res.data.payload?.headers;
  return {
    id,
    subject: headerValue(headers, "Subject"),
    from: headerValue(headers, "From"),
    date: headerValue(headers, "Date"),
    snippet: res.data.snippet ?? "",
  };
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function extractPlainText(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  for (const part of payload.parts ?? []) {
    const text = extractPlainText(part);
    if (text) return text;
  }
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return decodeBase64Url(payload.body.data).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  }
  return "";
}

export async function getMessageBody(gmail: gmail_v1.Gmail, id: string, maxChars = 5000): Promise<string> {
  const res = await gmail.users.messages.get({ userId: "me", id, format: "full" });
  return extractPlainText(res.data.payload).slice(0, maxChars);
}

export interface PdfAttachment {
  filename: string;
  attachmentId: string;
  sizeBytes: number;
}

export interface FullMessage extends MessageHeaders {
  body: string;
  internalDate: number;
  pdfAttachments: PdfAttachment[];
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function collectPdfAttachments(
  part: gmail_v1.Schema$MessagePart | undefined,
  results: PdfAttachment[],
): void {
  if (!part) return;
  const mt = part.mimeType ?? "";
  const name = part.filename ?? "";
  const isPdf =
    mt === "application/pdf" ||
    (mt === "application/octet-stream" && name.toLowerCase().endsWith(".pdf"));
  if (isPdf && part.body?.attachmentId) {
    results.push({
      filename: name || "attachment.pdf",
      attachmentId: part.body.attachmentId,
      sizeBytes: part.body.size ?? 0,
    });
  }
  for (const child of part.parts ?? []) collectPdfAttachments(child, results);
}

export async function getFullMessage(gmail: gmail_v1.Gmail, id: string, maxBodyChars = 5000): Promise<FullMessage> {
  const res = await gmail.users.messages.get({ userId: "me", id, format: "full" });
  const headers = res.data.payload?.headers;
  const pdfAttachments: PdfAttachment[] = [];
  collectPdfAttachments(res.data.payload, pdfAttachments);
  return {
    id,
    subject: headerValue(headers, "Subject"),
    from: headerValue(headers, "From"),
    date: headerValue(headers, "Date"),
    snippet: decodeHtmlEntities(res.data.snippet ?? ""),
    body: extractPlainText(res.data.payload).slice(0, maxBodyChars),
    internalDate: Number(res.data.internalDate ?? 0),
    pdfAttachments,
  };
}

export async function downloadAttachment(
  gmail: gmail_v1.Gmail,
  messageId: string,
  attachmentId: string,
): Promise<Buffer> {
  const res = await gmail.users.messages.attachments.get({
    userId: "me",
    messageId,
    id: attachmentId,
  });
  const data = res.data.data ?? "";
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

// Parse "Name <addr@host>" or bare "addr@host" -> { email, domain }
export function parseSender(from: string): { email: string; domain: string } {
  const match = from.match(/<([^>]+)>/) ?? from.match(/([\w.+-]+@[\w.-]+)/);
  const email = match?.[1]?.toLowerCase() ?? "";
  const at = email.indexOf("@");
  const fullDomain = at >= 0 ? email.slice(at + 1) : "";
  const parts = fullDomain.split(".");
  const rootDomain = parts.length >= 2 ? parts.slice(-2).join(".") : fullDomain;
  return { email, domain: rootDomain };
}
