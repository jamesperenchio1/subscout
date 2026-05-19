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
    .from("gmail_accounts")
    .select("id, google_email, is_enabled, connection_status, last_synced_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) return new NextResponse(error.message, { status: 500 });

  return NextResponse.json({ accounts: data ?? [] });
}
