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

  // Parse reason from JSON body (fetch-based) or fall back to default
  let reason = "one_time";
  let canonical_brand: string | undefined;
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const body = await req.json();
      reason = body.reason ?? "one_time";
      canonical_brand = body.canonical_brand || undefined;
    } catch { /* use defaults */ }
  }

  // Fetch subscription to get current overrides + service info
  const { data: sub } = await db
    .from("subscriptions")
    .select("id, service_brand, payment_source, user_overrides")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!sub) return new NextResponse("Not found", { status: 404 });

  const existingOverrides = (sub.user_overrides as Record<string, unknown>) ?? {};
  const updatedOverrides = {
    ...existingOverrides,
    dismissed_reason: reason,
    ...(canonical_brand ? { canonical_brand } : {}),
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

  // Persist dismissed pattern so future scans respect it
  try {
    await db.from("dismissed_patterns").insert({
      user_id: userId,
      service_brand: sub.service_brand,
      payment_source: sub.payment_source,
      reason,
      canonical_brand: canonical_brand ?? null,
    });
  } catch { /* dismissed_patterns table may not exist yet */ }

  // For legacy form POSTs, redirect; for fetch requests, return JSON
  if (!contentType.includes("application/json")) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  return NextResponse.json({ ok: true });
}
