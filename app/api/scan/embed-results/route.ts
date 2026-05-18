import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { toPgVector } from "@/lib/scan/vector";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface EmbedResult {
  event_id: string;
  embedding: number[];
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !userId) return new NextResponse("Unauthorized", { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { results?: EmbedResult[] };
  const results = body.results ?? [];
  if (!Array.isArray(results) || results.length === 0) {
    return NextResponse.json({ updated: 0 });
  }

  const db = supabaseAdmin();
  let updated = 0;
  for (const item of results) {
    if (!item?.event_id || !Array.isArray(item.embedding) || item.embedding.length !== 384) continue;
    const { error } = await db
      .from("email_events")
      .update({ embedding: toPgVector(item.embedding) })
      .eq("id", item.event_id)
      .eq("user_id", userId)
      .is("embedding", null);
    if (!error) updated++;
  }

  return NextResponse.json({ updated });
}
