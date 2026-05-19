"use client";

import { useState } from "react";
import { SubscriptionCard } from "@/components/subscription-card";
import { PossibleSubsSection } from "./possible-subs-section";
import { formatMoney, daysUntil } from "@/lib/format";

interface Sub {
  id: string;
  service_brand: string;
  payment_source: string;
  amount: number | null;
  currency: string | null;
  billing_cycle: string | null;
  next_renewal_date: string | null;
  last_charge_date: string | null;
  trial_ends_at: string | null;
  status: string;
  evidence_strength: string;
  category: string | null;
  cancellation_link: string | null;
  brand_logo_url: string | null;
}

interface PossibleSub {
  id: string;
  service_brand: string;
  payment_source: string;
  amount: number | null;
  currency: string | null;
  billing_cycle: string | null;
  next_renewal_date: string | null;
  brand_logo_url: string | null;
  category: string | null;
  status: string;
}

interface DashboardTabsProps {
  activeSubs: Sub[];
  possibleSubs: PossibleSub[];
  canceledCount: number;
  topCategories: [string, { count: number; monthly: number }][];
  homeCurrency: string;
}

export function DashboardTabs({
  activeSubs,
  possibleSubs,
  canceledCount,
  topCategories,
  homeCurrency,
}: DashboardTabsProps) {
  const [tab, setTab] = useState<"active" | "one-offs">("active");

  return (
    <>
      {/* Tab bar */}
      <div className="flex gap-1 rounded-2xl border border-stone-200 bg-white p-1 w-fit">
        <button
          onClick={() => setTab("active")}
          className={`rounded-xl px-5 py-2 text-sm font-semibold transition-colors ${
            tab === "active"
              ? "bg-stone-950 text-white"
              : "text-stone-600 hover:text-stone-950"
          }`}
        >
          Active{activeSubs.length > 0 ? ` (${activeSubs.length})` : ""}
        </button>
        <button
          onClick={() => setTab("one-offs")}
          className={`rounded-xl px-5 py-2 text-sm font-semibold transition-colors ${
            tab === "one-offs"
              ? "bg-stone-950 text-white"
              : "text-stone-600 hover:text-stone-950"
          }`}
        >
          One-offs{possibleSubs.length > 0 ? ` (${possibleSubs.length})` : ""}
        </button>
      </div>

      {tab === "active" ? (
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
                Confirmed = 2+ matching charges found in your inbox. One-offs = single billing event without a repeat pattern.
              </p>
            </div>
            {canceledCount > 0 && (
              <div className="rounded-2xl border border-stone-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Past subscriptions</p>
                <p className="mt-2 text-sm text-stone-600">{canceledCount} canceled or expired</p>
              </div>
            )}
          </aside>

          <div>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-stone-500">Confirmed subscriptions</p>
                <h2 className="text-2xl font-semibold tracking-tight">Recurring spend</h2>
              </div>
            </div>
            {activeSubs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center">
                <h2 className="text-lg font-semibold">No confirmed subscriptions yet</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-stone-600">
                  We didn&apos;t see 2+ matching charges for any service. Check the &ldquo;One-offs&rdquo; tab or rescan once more billing arrives.
                </p>
              </div>
            ) : (
              <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {activeSubs.map((s) => (
                  <SubscriptionCard key={s.id} sub={s} />
                ))}
              </section>
            )}
          </div>
        </section>
      ) : (
        <div>
          {possibleSubs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center">
              <h2 className="text-lg font-semibold">No one-offs found</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-stone-600">
                Single billing events that don&apos;t repeat will appear here.
              </p>
            </div>
          ) : (
            <PossibleSubsSection subs={possibleSubs} />
          )}
        </div>
      )}
    </>
  );
}
