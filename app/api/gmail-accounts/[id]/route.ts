import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !userId) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  let body: { is_enabled?: boolean };
  try { body = await req.json(); } catch { return new NextResponse("Invalid JSON", { status: 400 }); }

  const update: Record<string, unknown> = {};
  if (typeof body.is_enabled === "boolean") update.is_enabled = body.is_enabled;
  if (Object.keys(update).length === 0) return new NextResponse("Nothing to update", { status: 400 });

  const db = supabaseAdmin();
  const { error } = await db
    .from("gmail_accounts")
    .update(update)
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !userId) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const db = supabaseAdmin();

  // Cascade delete handles email_events + subscription_evidence rows.
  // Subscriptions with zero remaining evidence get cleaned up next.
  const { error } = await db
    .from("gmail_accounts")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return new NextResponse(error.message, { status: 500 });

  // Orphan subscriptions = no evidence rows left. Delete them.
  const { data: orphans } = await db
    .from("subscriptions")
    .select("id, subscription_evidence(count)")
    .eq("user_id", userId);
  const toDelete = (orphans ?? []).filter(
    (s: { id: string; subscription_evidence?: { count: number }[] }) =>
      !s.subscription_evidence?.length || s.subscription_evidence[0].count === 0,
  );
  if (toDelete.length) {
    await db
      .from("subscriptions")
      .delete()
      .in("id", toDelete.map((s) => s.id))
      .eq("user_id", userId);
  }

  return NextResponse.json({ ok: true });
}
