import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { encrypt } from "@/lib/crypto";
import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { google } from "googleapis";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "gmail_link_state";

function verifyState(userId: string, nonce: string, sig: string): boolean {
  const secret = process.env.ENCRYPTION_KEY ?? "";
  const expected = createHmac("sha256", secret).update(`${userId}:${nonce}`).digest("hex");
  return expected === sig;
}

function callbackUrl(req: Request): string {
  const u = new URL(req.url);
  return `${u.protocol}//${u.host}/api/gmail-accounts/connect/callback`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const dashboardUrl = new URL("/settings", req.url);

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !userId) {
    dashboardUrl.searchParams.set("error", "not_signed_in");
    return NextResponse.redirect(dashboardUrl);
  }

  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const cookieJar = await cookies();
  const stateCookie = cookieJar.get(STATE_COOKIE)?.value;
  cookieJar.delete(STATE_COOKIE);

  if (!code || !stateParam || !stateCookie || stateParam !== stateCookie) {
    dashboardUrl.searchParams.set("error", "invalid_state");
    return NextResponse.redirect(dashboardUrl);
  }
  const [stateUid, nonce, sig] = stateParam.split(".");
  if (stateUid !== userId || !verifyState(userId, nonce ?? "", sig ?? "")) {
    dashboardUrl.searchParams.set("error", "state_mismatch");
    return NextResponse.redirect(dashboardUrl);
  }

  // Exchange code for tokens using a fresh OAuth client
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl(req),
  );
  try {
    const { tokens } = await oauth2.getToken(code);
    const refreshToken = tokens.refresh_token;
    if (!refreshToken) {
      dashboardUrl.searchParams.set("error", "no_refresh_token");
      return NextResponse.redirect(dashboardUrl);
    }
    oauth2.setCredentials(tokens);

    // Fetch the connected account's email
    const userinfo = await google.oauth2({ version: "v2", auth: oauth2 }).userinfo.get();
    const email = userinfo.data.email;
    if (!email) {
      dashboardUrl.searchParams.set("error", "no_email");
      return NextResponse.redirect(dashboardUrl);
    }

    // Persist for the currently logged-in user — no session swap
    const db = supabaseAdmin();
    const { error } = await db.from("gmail_accounts").upsert(
      {
        user_id: userId,
        google_email: email,
        refresh_token_encrypted: encrypt(refreshToken),
        is_enabled: true,
        connection_status: "connected",
      },
      { onConflict: "user_id,google_email" },
    );
    if (error) {
      console.error("[gmail-link] upsert failed:", error.message);
      dashboardUrl.searchParams.set("error", "db_error");
      return NextResponse.redirect(dashboardUrl);
    }

    dashboardUrl.searchParams.set("connected", email);
    return NextResponse.redirect(dashboardUrl);
  } catch (err) {
    console.error("[gmail-link] token exchange failed:", err);
    dashboardUrl.searchParams.set("error", "oauth_failed");
    return NextResponse.redirect(dashboardUrl);
  }
}
