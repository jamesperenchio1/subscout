import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const VALID_TYPES = [
  "wrong_brand",
  "wrong_amount",
  "wrong_cycle",
  "wrong_status",
  "not_subscription",
  "missing_subscription",
] as const;

type FeedbackType = (typeof VALID_TYPES)[number];

interface FeedbackBody {
  subscription_id?: string;
  feedback_type: FeedbackType;
  correct_brand?: string;
  correct_amount?: number;
  correct_cycle?: string;
  correct_status?: string;
  notes?: string;
}

function isValidFeedbackType(v: unknown): v is FeedbackType {
  return typeof v === "string" && VALID_TYPES.includes(v as FeedbackType);
}

/* ------------------------------------------------------------------ */
// GET  /api/feedback
/* ------------------------------------------------------------------ */
export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("user_feedback")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return new NextResponse(error.message, { status: 500 });
  }

  return NextResponse.json({ feedback: data ?? [] });
}

/* ------------------------------------------------------------------ */
// POST /api/feedback
/* ------------------------------------------------------------------ */
export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return new NextResponse("Invalid body", { status: 400 });
  }

  const b = body as Record<string, unknown>;

  if (!isValidFeedbackType(b.feedback_type)) {
    return new NextResponse("Invalid feedback_type", { status: 400 });
  }

  const payload: FeedbackBody = {
    feedback_type: b.feedback_type,
  };

  if (b.subscription_id !== undefined) {
    if (typeof b.subscription_id !== "string") {
      return new NextResponse("Invalid subscription_id", { status: 400 });
    }
    payload.subscription_id = b.subscription_id;
  }

  if (b.correct_brand !== undefined) {
    if (typeof b.correct_brand !== "string") {
      return new NextResponse("Invalid correct_brand", { status: 400 });
    }
    payload.correct_brand = b.correct_brand;
  }

  if (b.correct_amount !== undefined) {
    const num = Number(b.correct_amount);
    if (!Number.isFinite(num) || num < 0) {
      return new NextResponse("Invalid correct_amount", { status: 400 });
    }
    payload.correct_amount = num;
  }

  if (b.correct_cycle !== undefined) {
    if (typeof b.correct_cycle !== "string") {
      return new NextResponse("Invalid correct_cycle", { status: 400 });
    }
    payload.correct_cycle = b.correct_cycle;
  }

  if (b.correct_status !== undefined) {
    if (typeof b.correct_status !== "string") {
      return new NextResponse("Invalid correct_status", { status: 400 });
    }
    payload.correct_status = b.correct_status;
  }

  if (b.notes !== undefined) {
    if (typeof b.notes !== "string") {
      return new NextResponse("Invalid notes", { status: 400 });
    }
    payload.notes = b.notes;
  }

  const db = supabaseAdmin();

  // Insert feedback record
  const { data: inserted, error: insertError } = await db
    .from("user_feedback")
    .insert({
      user_id: userId,
      subscription_id: payload.subscription_id ?? null,
      feedback_type: payload.feedback_type,
      correct_brand: payload.correct_brand ?? null,
      correct_amount: payload.correct_amount ?? null,
      correct_cycle: payload.correct_cycle ?? null,
      correct_status: payload.correct_status ?? null,
      notes: payload.notes ?? null,
    })
    .select("id")
    .single();

  if (insertError) {
    return new NextResponse(insertError.message, { status: 500 });
  }

  // If corrections are provided for an existing subscription, merge into user_overrides
  if (payload.subscription_id) {
    const hasCorrections =
      payload.correct_brand !== undefined ||
      payload.correct_amount !== undefined ||
      payload.correct_cycle !== undefined ||
      payload.correct_status !== undefined;

    if (hasCorrections) {
      const { data: existing } = await db
        .from("subscriptions")
        .select("id, user_overrides")
        .eq("id", payload.subscription_id)
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        const overrides = (existing.user_overrides as Record<string, unknown> | null) ?? {};
        const next = { ...overrides };
        if (payload.correct_brand !== undefined) next.brand_name = payload.correct_brand;
        if (payload.correct_amount !== undefined) next.amount = payload.correct_amount;
        if (payload.correct_cycle !== undefined) next.billing_cycle = payload.correct_cycle;
        if (payload.correct_status !== undefined) next.status = payload.correct_status;

        const update: Record<string, unknown> = {
          user_overrides: next,
          updated_at: new Date().toISOString(),
        };
        if (payload.correct_brand !== undefined) update.service_brand = payload.correct_brand;
        if (payload.correct_amount !== undefined) update.amount = payload.correct_amount;
        if (payload.correct_cycle !== undefined) update.billing_cycle = payload.correct_cycle;
        if (payload.correct_status !== undefined) update.status = payload.correct_status;

        await db.from("subscriptions").update(update).eq("id", payload.subscription_id).eq("user_id", userId);
      }
    }
  }

  return NextResponse.json({ ok: true, id: inserted?.id });
}
