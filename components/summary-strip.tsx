import { monthlyAmount, formatMoney, daysUntil } from "@/lib/format";

interface Sub {
  amount: number | null;
  currency: string | null;
  billing_cycle: string | null;
  next_renewal_date: string | null;
  service_name: string;
}

export function SummaryStrip({ subscriptions }: { subscriptions: Sub[] }) {
  const monthlyTotal = subscriptions.reduce((sum, s) => sum + monthlyAmount(s.amount, s.billing_cycle), 0);
  const currency = subscriptions[0]?.currency ?? "USD";
  const active = subscriptions.length;
  const upcoming = subscriptions
    .filter((s) => s.next_renewal_date)
    .sort((a, b) => (a.next_renewal_date! < b.next_renewal_date! ? -1 : 1))[0];

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card label="Monthly spend" value={formatMoney(monthlyTotal, currency)} sub="Across active subs" />
      <Card label="Active subscriptions" value={String(active)} sub={active === 1 ? "1 service" : `${active} services`} />
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

function Card({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{sub}</p>
    </div>
  );
}
