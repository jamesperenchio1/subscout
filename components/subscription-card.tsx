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

const CATEGORY_COLORS: Record<string, string> = {
  entertainment: "bg-purple-100 text-purple-800",
  saas: "bg-blue-100 text-blue-800",
  health: "bg-rose-100 text-rose-800",
  food: "bg-orange-100 text-orange-800",
  finance: "bg-emerald-100 text-emerald-800",
  utilities: "bg-amber-100 text-amber-800",
  other: "bg-stone-100 text-stone-800",
};

const PAYMENT_SOURCE_LABEL: Record<string, string> = {
  direct: "Direct",
  apple: "Apple",
  google_play: "Google Play",
  manual: "Manual",
};

function paymentLabel(source: string): string {
  if (source.startsWith("card_")) return `Card · ${source.slice(5)}`;
  return PAYMENT_SOURCE_LABEL[source] ?? source;
}

export function SubscriptionCard({ sub }: { sub: Sub }) {
  const cat = sub.category ?? "other";
  const days = sub.next_renewal_date ? daysUntil(sub.next_renewal_date) : null;
  const isFailed = sub.status === "payment_failed";
  const isTrial = sub.status === "trial";

  return (
    <article className={`flex flex-col rounded-2xl border bg-white p-5 ${isFailed ? "border-red-300" : isTrial ? "border-amber-300" : "border-stone-200"}`}>
      {isFailed && (
        <div className="mb-3 rounded-md bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
          ⚠ Payment failed — update billing info
        </div>
      )}
      {isTrial && sub.trial_ends_at && (
        <div className="mb-3 rounded-md bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
          ⏳ Trial ends {sub.trial_ends_at} ({daysUntil(sub.trial_ends_at)}d)
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {sub.brand_logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sub.brand_logo_url}
              alt=""
              className="h-9 w-9 rounded-lg bg-stone-100 object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <h3 className="truncate text-base font-semibold tracking-tight text-stone-900">
            {sub.service_brand}
          </h3>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.other}`}>
          {cat}
        </span>
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight">
          {sub.amount != null ? formatMoney(sub.amount, sub.currency ?? "USD") : "—"}
        </span>
        <span className="text-sm text-stone-500">/ {sub.billing_cycle ?? "unknown"}</span>
      </div>

      <dl className="mt-4 space-y-1 text-sm text-stone-600">
        <div className="flex justify-between">
          <dt>Next renewal</dt>
          <dd>
            {sub.next_renewal_date
              ? `${sub.next_renewal_date}${days !== null ? ` · ${days}d` : ""}`
              : "Unknown"}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt>Last charge</dt>
          <dd>{sub.last_charge_date ?? "—"}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Billed via</dt>
          <dd className="font-medium text-stone-700">{paymentLabel(sub.payment_source)}</dd>
        </div>
      </dl>

      {sub.cancellation_link && (
        <a
          href={sub.cancellation_link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center justify-center rounded-full border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
        >
          Cancel subscription →
        </a>
      )}
    </article>
  );
}
