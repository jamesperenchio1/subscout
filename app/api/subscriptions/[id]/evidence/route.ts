import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type GmailAccLite = { google_email: string | null } | { google_email: string | null }[] | null;
type EvRow = {
  id: string;
  subject: string | null;
  sender_email: string | null;
  sent_at: string | null;
  gmail_message_id: string | null;
  amount: number | null;
  currency: string | null;
  event_type: string | null;
  raw_extract: Record<string, unknown> | null;
  gmail_accounts: GmailAccLite;
};

function pickAccountEmail(g: GmailAccLite): string | null {
  if (!g) return null;
  if (Array.isArray(g)) return g[0]?.google_email ?? null;
  return g.google_email ?? null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !userId) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const db = supabaseAdmin();

  const { data: sub } = await db
    .from("subscriptions")
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!sub) return new NextResponse("Not found", { status: 404 });

  const { data: evidenceRows } = await db
    .from("subscription_evidence")
    .select(
      "email_events(id, subject, sender_email, sent_at, gmail_message_id, amount, currency, event_type, raw_extract, gmail_accounts(google_email))",
    )
    .eq("subscription_id", id);

  const emails: {
    id: string;
    subject: string | null;
    sender_email: string | null;
    sent_at: string | null;
    gmail_message_id: string | null;
    amount: number | null;
    currency: string | null;
    event_type: string | null;
    snippet: string | null;
    source_email: string | null;
  }[] = [];

  for (const row of evidenceRows ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ev = (Array.isArray((row as any).email_events) ? (row as any).email_events[0] : (row as any).email_events) as EvRow | null;
    if (!ev) continue;
    emails.push({
      id: ev.id,
      subject: ev.subject,
      sender_email: ev.sender_email,
      sent_at: ev.sent_at,
      gmail_message_id: ev.gmail_message_id,
      amount: ev.amount,
      currency: ev.currency,
      event_type: ev.event_type,
      snippet: (ev.raw_extract?.snippet as string | undefined) ?? null,
      source_email: pickAccountEmail(ev.gmail_accounts),
    });
  }

  emails.sort((a, b) => (b.sent_at ?? "").localeCompare(a.sent_at ?? ""));

  const sourceEmails = Array.from(new Set(emails.map((e) => e.source_email).filter(Boolean) as string[]));
  return NextResponse.json({ emails, source_emails: sourceEmails });
}
