import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { encrypt } from "@/lib/crypto";
import { SummaryStrip } from "@/components/summary-strip";
import { SubscriptionCard } from "@/components/subscription-card";
import { FirstScanPanel } from "@/components/first-scan-panel";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !userId) redirect("/");

  const db = supabaseAdmin();

  let { data: accounts } = await db
    .from("connected_accounts")
    .select("id, user_id, google_email, google_refresh_token, last_scanned_at")
    .eq("user_id", userId);

  // Bootstrap connected_accounts from next_auth.accounts if missing
  if (!accounts?.length) {
    const { data: oauthAccount } = await db
      .schema("next_auth")
      .from("accounts")
      .select('refresh_token, "providerAccountId"')
      .eq("userId", userId)
      .eq("provider", "google")
      .maybeSingle();

    if (oauthAccount?.refresh_token) {
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
  }

  const account = accounts?.[0];
  const needsScan = !account?.last_scanned_at;

  const { data: subs } = await db
    .from("subscriptions")
    .select(
      "id, service_name, amount, currency, billing_cycle, next_renewal_date, category, status, cancellation_link, email_used, source_email_id",
    )
    .eq("user_id", userId)
    .in("status", ["active", "payment_failed"])
    .order("next_renewal_date", { ascending: true, nullsFirst: false });

  const subscriptions = subs ?? [];

  async function disconnect() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight">SubScout</span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-800">
              beta
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
            <span>{session.user?.email}</span>
            <form action={disconnect}>
              <button className="rounded-md border border-zinc-200 px-3 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-6 py-10">
        {needsScan ? (
          <FirstScanPanel />
        ) : (
          <>
            <SummaryStrip subscriptions={subscriptions} />
            {subscriptions.length === 0 ? (
              <EmptyState />
            ) : (
              <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {subscriptions.map((s) => (
                  <SubscriptionCard key={s.id} sub={s} />
                ))}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-950">
      <h2 className="text-lg font-semibold">No subscriptions found</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
        We didn&apos;t detect any active subscriptions in the last 12 months of billing emails.
      </p>
      <form action="/dashboard">
        <button className="mt-6 rounded-full bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-white dark:text-black">
          Refresh
        </button>
      </form>
    </div>
  );
}
