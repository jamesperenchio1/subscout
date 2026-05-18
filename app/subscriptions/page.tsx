import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { SubscriptionCard } from "@/components/subscription-card";
import { PossibleSubsSection } from "@/components/dashboard/possible-subs-section";

export const dynamic = "force-dynamic";

const STATUS_ORDER = ["active", "trial", "payment_failed", "possible", "canceled", "dismissed"];

export default async function SubscriptionsPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !userId) redirect("/");

  const db = supabaseAdmin();

  const { data: subs } = await db
    .from("subscriptions")
    .select(
      "id, service_brand, payment_source, amount, currency, billing_cycle, next_renewal_date, last_charge_date, trial_ends_at, status, evidence_strength, category, cancellation_link, brand_logo_url",
    )
    .eq("user_id", userId)
    .order("service_brand", { ascending: true });

  const all = (subs ?? []).sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
  );

  const active = all.filter((s) => ["active", "payment_failed", "trial"].includes(s.status));
  const possible = all.filter((s) => s.status === "possible");
  const canceled = all.filter((s) => s.status === "canceled");

  return (
    <div className="flex flex-1 flex-col bg-[#f7f4ee] text-stone-950">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm text-stone-500 hover:text-stone-800">
              ← Dashboard
            </Link>
            <span className="text-stone-300">/</span>
            <span className="text-sm font-semibold">All subscriptions</span>
          </div>
          <span className="text-sm text-stone-500">{all.length} total</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-10 px-5 py-8 sm:px-8">
        {all.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-16 text-center">
            <h2 className="text-lg font-semibold">No subscriptions found</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-stone-600">
              Run a scan from the dashboard to detect your subscriptions.
            </p>
            <Link
              href="/dashboard"
              className="mt-6 inline-block rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white"
            >
              Go to dashboard
            </Link>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <section>
                <div className="mb-4 flex items-baseline justify-between">
                  <h2 className="text-xl font-semibold tracking-tight">Active</h2>
                  <span className="text-sm text-stone-500">{active.length}</span>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {active.map((s) => (
                    <SubscriptionCard key={s.id} sub={s} />
                  ))}
                </div>
              </section>
            )}

            {possible.length > 0 && (
              <PossibleSubsSection subs={possible} />
            )}

            {canceled.length > 0 && (
              <section>
                <div className="mb-4 flex items-baseline justify-between">
                  <h2 className="text-xl font-semibold tracking-tight text-stone-500">Past</h2>
                  <span className="text-sm text-stone-400">{canceled.length}</span>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 opacity-60">
                  {canceled.map((s) => (
                    <SubscriptionCard key={s.id} sub={s} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
