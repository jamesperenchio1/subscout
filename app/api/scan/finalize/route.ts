import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { finalizeScanAfterEmbeddings } from "@/lib/scan/orchestrator";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !userId) return new NextResponse("Unauthorized", { status: 401 });

  const db = supabaseAdmin();
  const { data: account, error } = await db
    .from("gmail_accounts")
    .select("user_id, google_email")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) return new NextResponse(error.message, { status: 500 });
  if (!account) return new NextResponse("No Gmail account linked", { status: 400 });

  const result = await finalizeScanAfterEmbeddings({
    user_id: account.user_id as string,
    google_email: account.google_email as string,
  });

  return NextResponse.json({ result });
}
