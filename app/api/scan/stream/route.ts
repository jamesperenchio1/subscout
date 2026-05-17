import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { encrypt } from "@/lib/crypto";
import { runInitialScan, type ScanEvent } from "@/lib/scan";

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
        controller.enqueue(new TextEncoder().encode(sse(event)));
      };

      try {
        // Get or bootstrap connected_accounts
        let { data: accounts } = await db
          .from("connected_accounts")
          .select("id, user_id, google_email, google_refresh_token, last_scanned_at")
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
            .from("connected_accounts")
            .upsert(
              {
                user_id: userId,
                google_email: email,
                google_refresh_token: encrypt(oauthAccount.refresh_token),
                is_primary: true,
              },
              { onConflict: "user_id,google_email" },
            )
            .select("id, user_id, google_email, google_refresh_token, last_scanned_at");
          accounts = created;
        }

        const account = accounts?.[0];
        if (!account) {
          send({ type: "error", message: "Could not create connected account." });
          controller.close();
          return;
        }

        // Reset scan watermark so it rescans
        await db
          .from("connected_accounts")
          .update({ last_scanned_at: null })
          .eq("id", account.id);

        await runInitialScan(
          {
            id: account.id,
            user_id: account.user_id,
            google_email: account.google_email,
            google_refresh_token: account.google_refresh_token,
          },
          send,
        );
      } catch (err) {
        send({ type: "error", message: String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
