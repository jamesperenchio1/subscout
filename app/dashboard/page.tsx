import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { encrypt } from "@/lib/crypto";
import { SubscriptionCard } from "@/components/subscription-card";
import { FirstScanPanel } from "@/components/first-scan-panel";
import { PossibleSubsSection } from "@/components/dashboard/possible-subs-section";
import { formatMoney, monthlyAmount, daysUntil } from "@/lib/format";
import { APP_NAME, HOME_CURRENCY } from "@/lib/thailand";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !userId) redirect("/");

  const db = supabaseAdmin();

  let { data: accounts } = await db
    .from("gmail_accounts")
    .select("id, google_email, scanned_through_date")
    .eq("user_id", userId);

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
        .from("gmail_accounts")
        .upsert(
          {
            user_id: userId,
            google_email: email,
            refresh_token_encrypted: encrypt(oauthAccount.refresh_token),
          },
          { onConflict: "user_id,google_email" },
        )
        .select("id, google_email, scanned_through_date");
      accounts = created;
    }
  }

  const account = accounts?.[0];

  // Count emails ingested → determines whether a scan has ever run
  const { count: emailCount } = await db
    .from("email_events")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  const needsScan = !account || !account.scanned_through_date || (emailCount ?? 0) === 0;

  const { data: subs } = await db
    .from("subscriptions")
    .select(
      "id, service_brand, payment_source, amount, currency, billing_cycle, next_renewal_date, last_charge_date, trial_ends_at, status, evidence_strength, category, cancellation_link, brand_logo_url",
    )
    .eq("user_id", userId)
    .order("next_renewal_date", { ascending: true, nullsFirst: false });

  const all = subs ?? [];
  const active = all.filter((s) => ["active", "payment_failed", "trial"].includes(s.status));
  const possible = all.filter((s) => s.status === "possible");
  const canceled = all.filter((s) => s.status === "canceled");

  const topCategories = Object.entries(
    active.reduce<Record<string, { count: number; monthly: number }>>((acc, sub) => {
      const category = sub.category ?? "other";
      const currency = sub.currency ?? HOME_CURRENCY;
      const monthly = currency === HOME_CURRENCY ? monthlyAmount(sub.amount, sub.billing_cycle) : 0;
      acc[category] = {
        count: (acc[category]?.count ?? 0) + 1,
        monthly: (acc[category]?.monthly ?? 0) + monthly,
      };
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1].monthly - a[1].monthly || b[1].count - a[1].count)
    .slice(0, 4);

  const upcoming = active
    .filter((sub) => sub.next_renewal_date)
    .sort((a, b) => (a.next_renewal_date! < b.next_renewal_date! ? -1 : 1))
    .slice(0, 4);

  async function disconnect() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <div className="flex flex-1 flex-col bg-[#f7f4ee] text-stone-950">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
            <span className="rounded-full bg-lime-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-stone-950">
              thai beta
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-3 text-sm text-stone-600">
            <span className="hidden truncate sm:inline">{session.user?.email}</span>
            <form action={disconnect}>
              <button className="rounded-full border border-stone-300 px-3 py-1.5 font-medium hover:bg-stone-100">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-8 px-5 py-8 sm:px-8">
        {needsScan ? (
          <FirstScanPanel />
        ) : (
          <>
            <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
              <div className="rounded-[2rem] bg-stone-950 p-6 text-white">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-200">Inbox intelligence</p>
                <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                  Your recurring spend, proven by recurring evidence.
                </h1>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <Signal label="Connected inbox" value={account?.google_email ?? "Gmail"} />
                  <Signal label="Confirmed" value={String(active.length)} />
                  <Signal label="Needs review" value={String(possible.length)} />
                </div>
              </div>
              <div className="rounded-[2rem] border border-stone-200 bg-white p-6">
                <p className="text-sm font-semibold text-stone-500">Next up</p>
                <div className="mt-4 space-y-3">
                  {upcoming.length ? upcoming.map((sub) => (
                    <div key={sub.id} className="flex items-center justify-between gap-3 rounded-2xl bg-stone-50 p-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{sub.service_brand}</p>
                        <p className="text-xs text-stone-500">
                          {sub.next_renewal_date ? `${sub.next_renewal_date} · ${daysUntil(sub.next_renewal_date)}d` : "Unknown date"}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold">{formatMoney(sub.amount ?? 0, sub.currency ?? HOME_CURRENCY)}</p>
                    </div>
                  )) : (
                    <p className="text-sm text-stone-500">No upcoming dates found yet.</p>
                  )}
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
              <aside className="space-y-4">
                <div className="rounded-2xl border border-stone-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Categories</p>
                  <div className="mt-4 space-y-3">
                    {topCategories.length ? topCategories.map(([category, data]) => (
                      <div key={category}>
                        <div className="flex justify-between text-sm">
                          <span className="font-medium capitalize">{category}</span>
                          <span className="text-stone-500">{data.count}</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-100">
                          <div
                            className="h-full rounded-full bg-lime-300"
                            style={{ width: `${Math.max(12, Math.min(100, data.monthly))}%` }}
                          />
                        </div>
                      </div>
                    )) : (
                      <p className="text-sm text-stone-500">Categories appear after scan.</p>
                    )}
                  </div>
                </div>
                <div className="rounded-2xl border border-stone-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">How detection works</p>
                  <p className="mt-3 text-sm leading-6 text-stone-600">
                    Each billing email is embedded locally and clustered with similar emails. A cluster becomes a subscription only when we see 2+ matching charges or an explicit confirmation.
                  </p>
                </div>
                {canceled.length > 0 && (
                  <div className="rounded-2xl border border-stone-200 bg-white p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Past subscriptions</p>
                    <p className="mt-2 text-sm text-stone-600">{canceled.length} canceled or expired</p>
                  </div>
                )}
              </aside>

              <div>
                <div className="mb-4 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-stone-500">Confirmed subscriptions</p>
                    <h2 className="text-2xl font-semibold tracking-tight">Recurring spend</h2>
                  </div>
                  <p className="text-sm text-stone-500">{active.length} active</p>
                </div>
                {active.length === 0 ? (
                  <EmptyState />
                ) : (
                  <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {active.map((s) => (
                      <SubscriptionCard key={s.id} sub={s} />
                    ))}
                  </section>
                )}
              </div>
            </section>

            {possible.length > 0 && (
              <PossibleSubsSection subs={possible} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center">
      <h2 className="text-lg font-semibold">No confirmed subscriptions yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-stone-600">
        We didn&apos;t see 2+ matching charges for any service. Check &ldquo;Possible subscriptions&rdquo; below or rescan once more billing arrives.
      </p>
      <form action="/dashboard">
        <button className="mt-6 rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white">
          Refresh
        </button>
      </form>
    </div>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 p-4">
      <p className="text-xs font-medium text-stone-400">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold">{value}</p>
    </div>
  );
}
