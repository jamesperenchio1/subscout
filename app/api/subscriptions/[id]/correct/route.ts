import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !userId) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const db = supabaseAdmin();

  // Verify ownership
  const { data: sub } = await db
    .from("subscriptions")
    .select("id, user_overrides")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!sub) return new NextResponse("Not found", { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const correctedBrand = typeof body.brand === "string" && body.brand.trim() ? body.brand.trim() : undefined;
  const correctedAmount = typeof body.amount === "number" ? body.amount : undefined;
  const correctedCurrency = typeof body.currency === "string" && body.currency.trim() ? body.currency.trim() : undefined;
  const correctedCycle = typeof body.cycle === "string" && body.cycle.trim() ? body.cycle.trim() : undefined;
  const correctedCategory = typeof body.category === "string" && body.category.trim() ? body.category.trim() : undefined;
  const correctedStatus = typeof body.status === "string" && body.status.trim() ? body.status.trim() : undefined;
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : undefined;
  const flagForReview = body.flag_for_review === true;

  // Insert into user_corrections
  const { error: insertErr } = await db.from("user_corrections").insert({
    user_id: userId,
    subscription_id: id,
    corrected_brand: correctedBrand ?? null,
    corrected_amount: correctedAmount ?? null,
    corrected_currency: correctedCurrency ?? null,
    corrected_cycle: correctedCycle ?? null,
    corrected_category: correctedCategory ?? null,
    corrected_status: correctedStatus ?? null,
    notes: notes ?? null,
  });
  if (insertErr) return new NextResponse(insertErr.message, { status: 500 });

  // Flag for review if requested
  if (flagForReview) {
    try {
      await db.from("review_queue").upsert({
        user_id: userId,
        subscription_id: id,
        reason: "user_flagged",
        resolved: false,
      }, { onConflict: "user_id,subscription_id" });
    } catch { /* table may not exist yet */ }
  }

  // Build update for subscriptions row + user_overrides
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const existingOverrides = (sub.user_overrides as Record<string, unknown> | null) ?? {};
  const newOverrides = { ...existingOverrides };

  if (correctedBrand !== undefined) {
    update.service_brand = correctedBrand;
    newOverrides.brand_name = correctedBrand;
  }
  if (correctedAmount !== undefined) {
    update.amount = correctedAmount;
    newOverrides.amount = correctedAmount;
  }
  if (correctedCurrency !== undefined) {
    update.currency = correctedCurrency;
    newOverrides.currency = correctedCurrency;
  }
  if (correctedCycle !== undefined) {
    update.billing_cycle = correctedCycle;
    newOverrides.billing_cycle = correctedCycle;
  }
  if (correctedCategory !== undefined) {
    update.category = correctedCategory;
    newOverrides.category = correctedCategory;
  }
  if (correctedStatus !== undefined) {
    update.status = correctedStatus;
    newOverrides.status = correctedStatus;
  }
  update.user_overrides = newOverrides;

  const { error: updateErr } = await db
    .from("subscriptions")
    .update(update)
    .eq("id", id)
    .eq("user_id", userId);
  if (updateErr) return new NextResponse(updateErr.message, { status: 500 });

  return NextResponse.json({ success: true });
}
