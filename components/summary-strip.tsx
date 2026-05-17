import { monthlyAmount, formatMoney, daysUntil } from "@/lib/format";
import { HOME_CURRENCY } from "@/lib/thailand";

interface Sub {
  amount: number | null;
  currency: string | null;
  billing_cycle: string | null;
  next_renewal_date: string | null;
  service_name: string;
}

export function SummaryStrip({ subscriptions }: { subscriptions: Sub[] }) {
  const byCurrency = subscriptions.reduce<Record<string, number>>((acc, s) => {
    const currency = s.currency ?? HOME_CURRENCY;
    acc[currency] = (acc[currency] ?? 0) + monthlyAmount(s.amount, s.billing_cycle);
    return acc;
  }, {});
  const currency = byCurrency[HOME_CURRENCY] != null ? HOME_CURRENCY : Object.keys(byCurrency)[0] ?? HOME_CURRENCY;
  const monthlyTotal = byCurrency[currency] ?? 0;
  const otherCurrencyCount = Math.max(Object.keys(byCurrency).length - 1, 0);
  const active = subscriptions.length;
  const upcoming = subscriptions
    .filter((s) => s.next_renewal_date)
    .sort((a, b) => (a.next_renewal_date! < b.next_renewal_date! ? -1 : 1))[0];

  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <Card
        tone="dark"
        label="Monthly burn"
        value={formatMoney(monthlyTotal, currency)}
        sub={otherCurrencyCount ? `Plus ${otherCurrencyCount} other currenc${otherCurrencyCount === 1 ? "y" : "ies"}` : "THB-first estimate"}
      />
      <Card label="Active subscriptions" value={String(active)} sub={active === 1 ? "1 service found" : `${active} services found`} />
      <Card
        label="Next renewal"
        value={upcoming ? upcoming.service_name : "—"}
        sub={
          upcoming
            ? `${formatMoney(upcoming.amount ?? 0, upcoming.currency ?? currency)} · in ${daysUntil(upcoming.next_renewal_date!)} days`
            : "Nothing scheduled"
        }
      />
    </section>
  );
}

function Card({ label, value, sub, tone = "light" }: { label: string; value: string; sub: string; tone?: "light" | "dark" }) {
  const isDark = tone === "dark";
  return (
    <div className={`rounded-2xl border p-5 ${isDark ? "border-stone-950 bg-stone-950 text-white" : "border-stone-200 bg-white text-stone-950"}`}>
      <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${isDark ? "text-lime-200" : "text-stone-500"}`}>{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
      <p className={`mt-1 text-sm ${isDark ? "text-stone-300" : "text-stone-500"}`}>{sub}</p>
    </div>
  );
}
