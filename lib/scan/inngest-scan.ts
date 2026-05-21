import { inngest } from "@/lib/inngest";
import { supabaseAdmin } from "@/lib/supabase";
import { encrypt } from "@/lib/crypto";
import { runScan, type ScanEvent } from "./orchestrator";

export const scanFunction = inngest.createFunction(
  { id: "scan-gmail-accounts", retries: 0, timeouts: { finish: "20m" }, triggers: [{ event: "scan/run" }] },
  async ({ event }) => {
    const { userId, jobId, userEmail } = event.data as {
      userId: string;
      jobId: string;
      userEmail: string;
    };
    const db = supabaseAdmin();

    const updateJob = (fields: Record<string, unknown>) =>
      db
        .from("scan_jobs")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", jobId);

    const fireUpdate = (fields: Record<string, unknown>) => {
      void (async () => { try { await updateJob(fields); } catch { /* fire-and-forget */ } })();
    };

    let progressCount = 0;
    const jobProgress = { current: 0, total: 0, filtered: 0 };
    let jobSummary: Record<string, number> | null = null;

    const emit = (scanEvent: ScanEvent) => {
      switch (scanEvent.type) {
        case "stage":
          fireUpdate({ status: "running", latest_stage: scanEvent.message });
          break;
        case "progress":
          progressCount++;
          jobProgress.current = scanEvent.current;
          jobProgress.total = scanEvent.total;
          if (scanEvent.filtered !== undefined) jobProgress.filtered = scanEvent.filtered;
          if (progressCount % 10 === 0) {
            fireUpdate({ progress: { ...jobProgress } });
          }
          break;
        case "summary":
          jobSummary = {
            confirmed: scanEvent.confirmed,
            possible: scanEvent.possible,
            canceled: scanEvent.canceled,
            trial: scanEvent.trial,
          };
          break;
      }
    };

    try {
      await updateJob({ status: "running", latest_stage: "Worker picked up job. Preparing Gmail accounts…" });

      let { data: accounts } = await db
        .from("gmail_accounts")
        .select("id, user_id, google_email, refresh_token_encrypted, is_enabled, connection_status")
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
          await updateJob({
            status: "error",
            error_message: "No Google refresh token found. Try signing out and back in.",
          });
          return;
        }

        const { data: created } = await db
          .from("gmail_accounts")
          .upsert(
            {
              user_id: userId,
              google_email: userEmail,
              refresh_token_encrypted: encrypt(oauthAccount.refresh_token),
            },
            { onConflict: "user_id,google_email" },
          )
          .select("id, user_id, google_email, refresh_token_encrypted, is_enabled, connection_status");

        accounts = created;
      }

      const scanList = (accounts ?? []).filter(
        (a) => a.is_enabled !== false && a.connection_status !== "disconnected",
      );

      if (!scanList.length) {
        await updateJob({
          status: "error",
          error_message: "No enabled Gmail accounts. Enable one in Settings.",
        });
        return;
      }

      for (const account of scanList) {
        try {
          await runScan(
            {
              id: account.id,
              user_id: account.user_id,
              google_email: account.google_email,
              google_refresh_token: account.refresh_token_encrypted,
            },
            emit,
          );
          await db
            .from("gmail_accounts")
            .update({ last_synced_at: new Date().toISOString(), connection_status: "connected" })
            .eq("id", account.id);
        } catch (perAccountErr) {
          const msg = String(perAccountErr);
          if (msg.includes("invalid_grant") || msg.includes("401") || msg.includes("403")) {
            await db
              .from("gmail_accounts")
              .update({ connection_status: "needs_reauth" })
              .eq("id", account.id);
            fireUpdate({
              latest_stage: `${account.google_email} needs reconnection — skipping`,
            });
          } else {
            throw perAccountErr;
          }
        }
      }

      await updateJob({
        status: "done",
        latest_stage: "Scan completed successfully",
        progress: { ...jobProgress },
        summary: jobSummary,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[inngest-scan] error:", msg);
      await updateJob({ status: "error", error_message: msg.slice(0, 500) });
    }
  },
);
