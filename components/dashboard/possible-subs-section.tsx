"use client";

import { formatMoney } from "@/lib/format";

interface PossibleSub {
  id: string;
  service_brand: string;
  payment_source: string;
  amount: number | null;
  currency: string | null;
  billing_cycle: string | null;
  brand_logo_url: string | null;
  category: string | null;
}

export function PossibleSubsSection({ subs }: { subs: PossibleSub[] }) {
  return (
    <section className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Possible subscriptions</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-stone-900">Need your input</h2>
          <p className="mt-2 text-sm text-stone-700">
            We saw 1 billing email for each of these services, but not enough evidence to confirm. Help us decide.
          </p>
        </div>
        <p className="text-sm text-amber-800">{subs.length} to review</p>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {subs.map((sub) => (
          <article key={sub.id} className="rounded-2xl bg-white p-4">
            <div className="flex items-center gap-3">
              {sub.brand_logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={sub.brand_logo_url}
                  alt=""
                  className="h-8 w-8 rounded-md bg-stone-100 object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-stone-900">{sub.service_brand}</p>
                <p className="text-xs text-stone-500">
                  {sub.amount != null ? formatMoney(sub.amount, sub.currency ?? "USD") : "Unknown amount"} · {sub.billing_cycle ?? "cycle unknown"}
                </p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <form action={`/api/subscriptions/${sub.id}/confirm`} method="post" className="flex-1">
                <button
                  type="submit"
                  className="w-full rounded-full bg-stone-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-stone-800"
                >
                  ✓ Confirm
                </button>
              </form>
              <form action={`/api/subscriptions/${sub.id}/dismiss`} method="post" className="flex-1">
                <button
                  type="submit"
                  className="w-full rounded-full border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                >
                  ✗ Dismiss
                </button>
              </form>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
