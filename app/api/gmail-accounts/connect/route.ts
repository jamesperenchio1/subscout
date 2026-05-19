import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "gmail_link_state";
const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
].join(" ");

function signState(userId: string, nonce: string): string {
  const secret = process.env.ENCRYPTION_KEY ?? "";
  return createHmac("sha256", secret).update(`${userId}:${nonce}`).digest("hex");
}

function callbackUrl(req: Request): string {
  const u = new URL(req.url);
  return `${u.protocol}//${u.host}/api/gmail-accounts/connect/callback`;
}

export async function GET(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !userId) return new NextResponse("Unauthorized", { status: 401 });

  const nonce = randomBytes(16).toString("hex");
  const sig = signState(userId, nonce);
  const state = `${userId}.${nonce}.${sig}`;

  (await cookies()).set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: callbackUrl(req),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent select_account",
    state,
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  return NextResponse.json({ url });
}
