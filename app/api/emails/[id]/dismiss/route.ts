import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !userId) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const db = supabaseAdmin();

  const { error } = await db
    .from("email_events")
    .update({ pdf_parse_status: "dismissed" })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return new NextResponse("DB error", { status: 500 });
  return NextResponse.json({ ok: true });
}
