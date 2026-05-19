import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { encrypt } from "@/lib/crypto";
import { FirstScanPanel } from "@/components/first-scan-panel";
import { DashboardTabs } from "@/components/dashboard/dashboard-tabs";
import { NeedsReviewSection } from "@/components/dashboard/needs-review-section";
import { formatMoney, monthlyAmount, daysUntil } from "@/lib/format";
import { HOME_CURRENCY } from "@/lib/thailand";

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

  const { count: emailCount } = await db
    .from("email_events")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  const needsScan = !account || !account.scanned_through_date || (emailCount ?? 0) === 0;

  const { data: needsReviewRaw } = await db
    .from("email_events")
    .select("id, subject, sender_email, sent_at, raw_extract, gmail_accounts(google_email)")
    .eq("user_id", userId)
    .eq("pdf_parse_status", "image_only")
    .order("sent_at", { ascending: false })
    .limit(50);

  const needsReview = (needsReviewRaw ?? []).map((row) => {
    const ga = row.gmail_accounts;
    const sourceEmail = Array.isArray(ga)
      ? (ga[0] as { google_email: string | null } | undefined)?.google_email ?? null
      : (ga as { google_email: string | null } | null)?.google_email ?? null;
    const pdfAttachments =
      (row.raw_extract as { pdf_attachments?: { filename: string; sizeBytes: number; status: string }[] } | null)
        ?.pdf_attachments?.filter((a) => a.status === "image_only") ?? [];
    return {
      id: row.id,
      subject: row.subject,
      sender_email: row.sender_email,
      sent_at: row.sent_at,
      source_email: sourceEmail,
      pdf_attachments: pdfAttachments,
    };
  });

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

  async function rescan() {
    "use server";
    const sess = await auth();
    const uid = (sess?.user as { id?: string } | undefined)?.id;
    if (!uid) return;
    const db = supabaseAdmin();
    await db.from("gmail_accounts").update({ scanned_through_date: null }).eq("user_id", uid);
    // Reset email classifications so the improved Groq prompt re-runs on existing emails
    await db
      .from("email_events")
      .update({ event_type: null, service_name_raw: null, service_brand: null, cluster_id: null })
      .eq("user_id", uid);
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 flex-col bg-[#f7f4ee] text-stone-950">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight">SubScout</span>
          </div>
          <div className="flex min-w-0 items-center gap-3 text-sm text-stone-600">
            <span className="hidden truncate sm:inline">{session.user?.email}</span>
            {(accounts?.length ?? 0) > 1 && (
              <span className="hidden rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700 sm:inline">
                {accounts!.length} inboxes
              </span>
            )}
            <Link
              href="/settings"
              className="rounded-full border border-stone-300 px-3 py-1.5 font-medium hover:bg-stone-100"
            >
              Settings
            </Link>
            {!needsScan && (
              <form action={rescan}>
                <button className="rounded-full border border-stone-300 px-3 py-1.5 font-medium hover:bg-stone-100">
                  Rescan
                </button>
              </form>
            )}
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
                  <Signal label="One-offs" value={String(possible.length)} />
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

            {needsReview.length > 0 && (
              <NeedsReviewSection initialEmails={needsReview} />
            )}

            <DashboardTabs
              activeSubs={active}
              possibleSubs={possible}
              canceledCount={canceled.length}
              topCategories={topCategories}
              homeCurrency={HOME_CURRENCY}
            />
          </>
        )}
      </main>
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
