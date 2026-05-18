import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { encrypt } from "@/lib/crypto";
import { runScan, type ScanEvent } from "@/lib/scan/orchestrator";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function sse(event: ScanEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const attempt = url.searchParams.get("attempt");
    const requestId =
      globalThis.crypto?.randomUUID?.() ??
      `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    console.log("[scan:stream] incoming request", { requestId, attempt });
    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!session || !userId) {
      console.warn("[scan:stream] unauthorized request", { requestId, hasSession: Boolean(session), userId: userId ?? null });
      return new Response("Unauthorized", { status: 401 });
    }
    console.log("[scan:stream] authenticated request", {
      requestId,
      userId,
      sessionEmail: session.user?.email ?? null,
      sessionName: session.user?.name ?? null,
      sessionImage: session.user?.image ?? null,
    });

    const db = supabaseAdmin();

    const stream = new ReadableStream({
      async start(controller) {
        let closed = false;
        let heartbeat: ReturnType<typeof setInterval> | null = null;
        const safeClose = () => {
          if (closed) return;
          closed = true;
          try {
            controller.close();
          } catch (err) {
            console.warn("[scan:stream] close failed", { requestId, error: String(err) });
          }
        };
        const send = (event: ScanEvent) => {
          try {
            if (closed) return;
            console.log("[scan:stream] emit", { requestId, eventType: event.type, event });
            controller.enqueue(new TextEncoder().encode(sse(event)));
          } catch (err) {
            console.warn("[scan:stream] enqueue failed", { requestId, error: String(err) });
          }
        };

        try {
          send({
            type: "verbose",
            stage: "stream",
            message: "SSE stream opened",
            data: { requestId, userId, sessionEmail: session.user?.email ?? null },
          });
          heartbeat = setInterval(() => {
            send({
              type: "verbose",
              stage: "stream",
              message: "SSE heartbeat",
              data: { requestId, ts: new Date().toISOString() },
            });
          }, 5000);

        // Get or bootstrap gmail_account
        let { data: accounts } = await db
          .from("gmail_accounts")
          .select("id, user_id, google_email, refresh_token_encrypted")
          .eq("user_id", userId);
        send({
          type: "verbose",
          stage: "account",
          message: "Loaded gmail_accounts rows",
          data: { requestId, count: accounts?.length ?? 0, accounts: accounts?.map((a) => ({ id: a.id, user_id: a.user_id, google_email: a.google_email })) ?? [] },
        });

        if (!accounts?.length) {
          const { data: oauthAccount } = await db
            .schema("next_auth")
            .from("accounts")
            .select('refresh_token, "providerAccountId"')
            .eq("userId", userId)
            .eq("provider", "google")
            .maybeSingle();
          send({
            type: "verbose",
            stage: "account",
            message: "Loaded OAuth account row",
            data: {
              requestId,
              providerAccountId: oauthAccount?.providerAccountId ?? null,
              hasRefreshToken: Boolean(oauthAccount?.refresh_token),
            },
          });

          if (!oauthAccount?.refresh_token) {
            send({ type: "error", message: "No Google account linked. Please sign in again." });
            return;
          }

          const email = session.user?.email ?? "";
          const { data: created } = await db
            .from("gmail_accounts")
            .upsert(
              {
                user_id: userId,
                google_email: email,
                refresh_token_encrypted: encrypt(oauthAccount.refresh_token),
              },
              { onConflict: "user_id,google_email" },
            )
            .select("id, user_id, google_email, refresh_token_encrypted");
          accounts = created;
          send({
            type: "verbose",
            stage: "account",
            message: "Bootstrapped gmail_account row",
            data: { requestId, count: accounts?.length ?? 0, accounts: accounts?.map((a) => ({ id: a.id, user_id: a.user_id, google_email: a.google_email })) ?? [] },
          });
        }

        const account = accounts?.[0];
        if (!account) {
          send({ type: "error", message: "Could not create Gmail account record." });
          return;
        }
        send({
          type: "verbose",
          stage: "account",
          message: "Selected gmail account for scan",
          data: { requestId, accountId: account.id, userId: account.user_id, googleEmail: account.google_email },
        });

        await runScan(
          {
            id: account.id,
            user_id: account.user_id,
            google_email: account.google_email,
            google_refresh_token: account.refresh_token_encrypted,
          },
          send,
        );
        } catch (err) {
          console.error("[scan:stream] uncaught stream error", { requestId, error: String(err) });
          send({ type: "error", message: String(err).slice(0, 200) });
        } finally {
          if (heartbeat) clearInterval(heartbeat);
          send({
            type: "verbose",
            stage: "stream",
            message: "SSE stream closing",
            data: { requestId },
          });
          safeClose();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    console.error("[scan:stream] GET fatal", { error: String(err), stack: err instanceof Error ? err.stack : undefined });
    return new Response(`Stream init failed: ${String(err).slice(0, 400)}`, { status: 500 });
  }
}
