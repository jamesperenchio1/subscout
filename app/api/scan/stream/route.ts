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
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const db = supabaseAdmin();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: ScanEvent) => {
        try {
          controller.enqueue(new TextEncoder().encode(sse(event)));
        } catch {
          // stream already closed
        }
      };

      try {
        // Get or bootstrap gmail_account
        let { data: accounts } = await db
          .from("gmail_accounts")
          .select("id, user_id, google_email, refresh_token_encrypted")
          .eq("user_id", userId);

        if (!accounts?.length) {
          const { data: oauthAccount } = await db
            .schema("next_auth")
            .from("accounts")
            .select('refresh_token, "providerAccountId"')
            .eq("userId", userId)
            .eq("provider", "google")
            .maybeSingle();

          if (!oauthAccount?.refresh_token) {
            send({ type: "error", message: "No Google account linked. Please sign in again." });
            controller.close();
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
        }

        const account = accounts?.[0];
        if (!account) {
          send({ type: "error", message: "Could not create Gmail account record." });
          controller.close();
          return;
        }

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
        send({ type: "error", message: String(err).slice(0, 200) });
      } finally {
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
