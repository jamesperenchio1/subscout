import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { buildEmbeddingText } from "@/lib/scan/orchestrator";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type EmbedCandidate = {
  event_id: string;
  text: string;
};

export async function POST(request: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !userId) return new NextResponse("Unauthorized", { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { limit?: number };
  const limit = Math.max(1, Math.min(50, Number(body.limit ?? 12)));
  const db = supabaseAdmin();

  const { data, error } = await db
    .from("email_events")
    .select("id, subject, raw_extract")
    .eq("user_id", userId)
    .is("embedding", null)
    .order("sent_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) return new NextResponse(error.message, { status: 500 });

  const candidates: EmbedCandidate[] = (data ?? []).map((row) => {
    const rawExtract = (row.raw_extract ?? {}) as { body?: string };
    return {
      event_id: row.id as string,
      text: buildEmbeddingText((row.subject as string | null) ?? "", rawExtract.body ?? ""),
    };
  });

  return NextResponse.json({ candidates });
}
