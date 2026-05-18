import { google, type gmail_v1 } from "googleapis";
import { decrypt } from "./crypto";
import { THAI_BILLING_TERMS } from "./thailand";

const BILLING_SUBJECT_QUERY =
  `subject:(receipt OR invoice OR "payment successful" OR "payment failed" OR "payment due" OR "payment received" OR "you've been charged" OR charge OR renewal OR subscription OR "your plan" OR "order confirmation" OR ${THAI_BILLING_TERMS.map((term) => `"${term}"`).join(" OR ")})`;
const BILLING_FROM_QUERY =
  `from:(billing OR invoice OR noreply OR payments OR receipts OR no-reply OR support OR hello OR accounts OR orders OR notifications OR receipt OR chargebee OR stripe OR paypal OR truemoney OR line OR grab OR shopee OR lazada OR ais OR true OR dtac OR kbank OR scb OR krungthai) OR ${BILLING_SUBJECT_QUERY}`;

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
  maxResults = 500,
): Promise<string[]> {
  const after = Math.floor(sinceDate.getTime() / 1000);
  const q = `${BILLING_FROM_QUERY} after:${after}`;
  const ids: string[] = [];
  let pageToken: string | undefined = undefined;
  while (ids.length < maxResults) {
    const res = await gmail.users.messages.list({
      userId: "me",
      q,
      maxResults: Math.min(500, maxResults - ids.length),
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

export interface FullMessage extends MessageHeaders {
  body: string;
  internalDate: number;
}

export async function getFullMessage(gmail: gmail_v1.Gmail, id: string, maxBodyChars = 5000): Promise<FullMessage> {
  const res = await gmail.users.messages.get({ userId: "me", id, format: "full" });
  const headers = res.data.payload?.headers;
  return {
    id,
    subject: headerValue(headers, "Subject"),
    from: headerValue(headers, "From"),
    date: headerValue(headers, "Date"),
    snippet: res.data.snippet ?? "",
    body: extractPlainText(res.data.payload).slice(0, maxBodyChars),
    internalDate: Number(res.data.internalDate ?? 0),
  };
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
