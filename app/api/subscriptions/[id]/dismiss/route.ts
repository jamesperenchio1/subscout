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

  let reason = "one_time";
  let canonicalBrand: string | undefined;
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const body = await req.json();
      reason = body.reason ?? "one_time";
      canonicalBrand = body.canonical_brand || undefined;
    } catch { /* use defaults */ }
  }

  // Fetch subscription to get service info
  const { data: sub } = await db
    .from("subscriptions")
    .select("id, service_brand, payment_source, user_overrides")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!sub) return new NextResponse("Not found", { status: 404 });

  if (reason === "not_subscription") {
    // Delete subscription and mark pattern in dismissed_patterns
    const { error: delErr } = await db.from("subscriptions").delete().eq("id", id).eq("user_id", userId);
    if (delErr) return new NextResponse(delErr.message, { status: 500 });

    try {
      await db.from("dismissed_patterns").insert({
        user_id: userId,
        service_brand: sub.service_brand,
        payment_source: sub.payment_source,
        reason: "not_subscription",
        canonical_brand: null,
      });
    } catch { /* dismissed_patterns table may not exist yet */ }
  } else if (reason === "wrong_merchant") {
    // Update subscription brand and persist pattern mapping
    const updatedOverrides: Record<string, unknown> = {
      ...(sub.user_overrides as Record<string, unknown> | null),
      dismissed_reason: reason,
      ...(canonicalBrand ? { canonical_brand: canonicalBrand } : {}),
    };

    const update: Record<string, unknown> = {
      user_overrides: updatedOverrides,
      updated_at: new Date().toISOString(),
    };
    if (canonicalBrand) {
      update.service_brand = canonicalBrand;
      updatedOverrides.brand_name = canonicalBrand;
      update.user_overrides = updatedOverrides;
    }

    const { error } = await db
      .from("subscriptions")
      .update(update)
      .eq("id", id)
      .eq("user_id", userId);
    if (error) return new NextResponse(error.message, { status: 500 });

    try {
      await db.from("dismissed_patterns").insert({
        user_id: userId,
        service_brand: sub.service_brand,
        payment_source: sub.payment_source,
        reason: "wrong_merchant",
        canonical_brand: canonicalBrand ?? null,
      });
    } catch { /* dismissed_patterns table may not exist yet */ }
  } else if (reason === "duplicate") {
    // Simplified: delete subscription and note in dismissed_patterns
    const { error: delErr } = await db.from("subscriptions").delete().eq("id", id).eq("user_id", userId);
    if (delErr) return new NextResponse(delErr.message, { status: 500 });

    try {
      await db.from("dismissed_patterns").insert({
        user_id: userId,
        service_brand: sub.service_brand,
        payment_source: sub.payment_source,
        reason: "duplicate",
        canonical_brand: null,
      });
    } catch { /* dismissed_patterns table may not exist yet */ }
  } else {
    // Default fallback: mark as dismissed (legacy behavior)
    const existingOverrides = (sub.user_overrides as Record<string, unknown>) ?? {};
    const updatedOverrides = {
      ...existingOverrides,
      dismissed_reason: reason,
      ...(canonicalBrand ? { canonical_brand: canonicalBrand } : {}),
    };

    const { error } = await db
      .from("subscriptions")
      .update({
        status: "dismissed",
        user_overrides: updatedOverrides,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId);
    if (error) return new NextResponse(error.message, { status: 500 });

    try {
      await db.from("dismissed_patterns").insert({
        user_id: userId,
        service_brand: sub.service_brand,
        payment_source: sub.payment_source,
        reason,
        canonical_brand: canonicalBrand ?? null,
      });
    } catch { /* dismissed_patterns table may not exist yet */ }
  }

  // For legacy form POSTs, redirect; for fetch requests, return JSON
  if (!contentType.includes("application/json")) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  return NextResponse.json({ success: true });
}
