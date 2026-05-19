import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !userId) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const db = supabaseAdmin();

  // Verify ownership and fetch current overrides
  const { data: existing } = await db
    .from("subscriptions")
    .select("id, user_overrides")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!existing) return new NextResponse("Not found", { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  // Build direct column updates from allowed fields
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.brand_name != null) update.service_brand = body.brand_name;
  if (body.billing_cycle != null) update.billing_cycle = body.billing_cycle;
  if (body.amount != null) update.amount = body.amount;
  if (body.currency != null) update.currency = body.currency;
  if (body.category != null) update.category = body.category;
  if (body.status != null) update.status = body.status;
  if (body.next_renewal_date != null) update.next_renewal_date = body.next_renewal_date || null;

  // Merge into user_overrides so rescan can re-apply these corrections
  const existingOverrides = (existing.user_overrides as Record<string, unknown>) ?? {};
  const newOverrides = { ...existingOverrides };
  if (body.brand_name != null) newOverrides.brand_name = body.brand_name;
  if (body.billing_cycle != null) newOverrides.billing_cycle = body.billing_cycle;
  if (body.amount != null) newOverrides.amount = body.amount;
  if (body.currency != null) newOverrides.currency = body.currency;
  if (body.category != null) newOverrides.category = body.category;
  if (body.status != null) newOverrides.status = body.status;
  if (body.next_renewal_date != null) newOverrides.next_renewal_date = body.next_renewal_date || null;
  update.user_overrides = newOverrides;

  const { error } = await db.from("subscriptions").update(update).eq("id", id).eq("user_id", userId);
  if (error) return new NextResponse(error.message, { status: 500 });

  return NextResponse.json({ ok: true });
}
