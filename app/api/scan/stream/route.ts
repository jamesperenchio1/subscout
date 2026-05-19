import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { encrypt } from "@/lib/crypto";
import { runScan, type ScanEvent } from "@/lib/scan/orchestrator";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function sse(event: ScanEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function GET() {
  console.log("[scan] GET handler entered");
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !userId) {
    console.log("[scan] no session, returning 401");
    return new Response("Unauthorized", { status: 401 });
  }

  console.log(`[scan] starting for user=${userId}`);

  const db = supabaseAdmin();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const send = (event: ScanEvent) => {
        if (closed) return;
        try {
          controller.enqueue(new TextEncoder().encode(sse(event)));
          if (event.type === "stage" || event.type === "error" || event.type === "done") {
            console.log(`[scan] ${event.type}:`, JSON.stringify(event));
          }
        } catch {
          closed = true;
        }
      };

      // Keep connection alive through proxy timeouts
      const heartbeat = setInterval(() => {
        if (closed) { clearInterval(heartbeat); return; }
        try {
          controller.enqueue(new TextEncoder().encode(": heartbeat\n\n"));
        } catch {
          closed = true;
          clearInterval(heartbeat);
        }
      }, 20_000);

      try {
        send({ type: "stage", stage: "init", message: "Authenticating with Gmail…" });

        let { data: accounts } = await db
          .from("gmail_accounts")
          .select("id, user_id, google_email, refresh_token_encrypted, is_enabled, connection_status")
          .eq("user_id", userId);

        if (!accounts?.length) {
          send({ type: "stage", stage: "init", message: "No Gmail account found — bootstrapping from OAuth…" });
          console.log(`[scan] no gmail_account for user=${userId}, looking up OAuth token`);

          const { data: oauthAccount } = await db
            .schema("next_auth")
            .from("accounts")
            .select('refresh_token, "providerAccountId"')
            .eq("userId", userId)
            .eq("provider", "google")
            .maybeSingle();

          if (!oauthAccount?.refresh_token) {
            const msg = "No Google refresh token found. Try signing out and back in.";
            console.error(`[scan] ${msg}`);
            send({ type: "error", message: msg });
            controller.close();
            return;
          }

          const email = session.user?.email ?? "";
          const { data: created, error: upsertErr } = await db
            .from("gmail_accounts")
            .upsert(
              {
                user_id: userId,
                google_email: email,
                refresh_token_encrypted: encrypt(oauthAccount.refresh_token),
              },
              { onConflict: "user_id,google_email" },
            )
            .select("id, user_id, google_email, refresh_token_encrypted, is_enabled, connection_status");

          if (upsertErr) {
            const msg = `Failed to save Gmail account: ${upsertErr.message}`;
            console.error(`[scan] ${msg}`);
            send({ type: "error", message: msg });
            controller.close();
            return;
          }

          accounts = created;
        }

        // Iterate every enabled, non-disconnected account
        const scanList = (accounts ?? []).filter(
          (a) => a.is_enabled !== false && a.connection_status !== "disconnected",
        );
        if (!scanList.length) {
          send({ type: "error", message: "No enabled Gmail accounts. Enable one in Settings." });
          controller.close();
          return;
        }

        for (const account of scanList) {
          send({ type: "stage", stage: "account", message: `Scanning ${account.google_email}…` });
          console.log(`[scan] running scan for gmail=${account.google_email}`);

          try {
            await runScan(
              {
                id: account.id,
                user_id: account.user_id,
                google_email: account.google_email,
                google_refresh_token: account.refresh_token_encrypted,
              },
              send,
            );
            await db
              .from("gmail_accounts")
              .update({
                last_synced_at: new Date().toISOString(),
                connection_status: "connected",
              })
              .eq("id", account.id);
            console.log(`[scan] completed for gmail=${account.google_email}`);
          } catch (perAccountErr) {
            const msg = String(perAccountErr);
            if (msg.includes("invalid_grant") || msg.includes("401") || msg.includes("403")) {
              await db
                .from("gmail_accounts")
                .update({ connection_status: "needs_reauth" })
                .eq("id", account.id);
              send({
                type: "stage",
                stage: "account",
                message: `${account.google_email} needs to be reconnected — skipping`,
              });
              continue;
            }
            throw perAccountErr;
          }
        }
      } catch (err) {
        const message = err instanceof Error
          ? `${err.message}\n${err.stack ?? ""}`
          : String(err);
        console.error(`[scan] unhandled error:`, message);
        send({ type: "error", message: message.slice(0, 500) });
      } finally {
        clearInterval(heartbeat);
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
