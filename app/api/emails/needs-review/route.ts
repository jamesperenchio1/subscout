import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !userId) return new NextResponse("Unauthorized", { status: 401 });

  const db = supabaseAdmin();

  const { data, error } = await db
    .from("email_events")
    .select("id, subject, sender_email, sent_at, raw_extract, gmail_accounts(google_email)")
    .eq("user_id", userId)
    .eq("pdf_parse_status", "image_only")
    .order("sent_at", { ascending: false })
    .limit(50);

  if (error) return new NextResponse("DB error", { status: 500 });

  const emails = (data ?? []).map((row) => {
    const ga = row.gmail_accounts;
    const sourceEmail = Array.isArray(ga)
      ? (ga[0] as { google_email: string | null } | undefined)?.google_email ?? null
      : (ga as { google_email: string | null } | null)?.google_email ?? null;
    const pdfAttachments = (row.raw_extract as { pdf_attachments?: { filename: string; sizeBytes: number; status: string }[] } | null)?.pdf_attachments ?? [];
    return {
      id: row.id,
      subject: row.subject,
      sender_email: row.sender_email,
      sent_at: row.sent_at,
      source_email: sourceEmail,
      pdf_attachments: pdfAttachments.filter((a) => a.status === "image_only"),
    };
  });

  return NextResponse.json({ emails });
}
