import { formatMoney, daysUntil } from "@/lib/format";
import { parseSourceEmails } from "@/lib/scan";
import { HOME_CURRENCY } from "@/lib/thailand";

interface Sub {
  id: string;
  service_name: string;
  amount: number | null;
  currency: string | null;
  billing_cycle: string | null;
  next_renewal_date: string | null;
  category: string | null;
  status: string | null;
  cancellation_link: string | null;
  email_used: string | null;
  source_email_id: string | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  entertainment: "bg-fuchsia-100 text-fuchsia-900",
  saas: "bg-sky-100 text-sky-900",
  health: "bg-rose-100 text-rose-900",
  food: "bg-orange-100 text-orange-900",
  finance: "bg-emerald-100 text-emerald-900",
  utilities: "bg-amber-100 text-amber-900",
  other: "bg-stone-100 text-stone-800",
};

const EVENT_TYPE_LABEL: Record<string, string> = {
  charge: "Receipt",
  renewal: "Renewal",
  subscription_confirmed: "Confirmed",
  failed_payment: "Failed payment",
  cancellation: "Cancelled",
  other: "Email",
  unknown: "Email",
};

export function SubscriptionCard({ sub }: { sub: Sub }) {
  const cat = sub.category ?? "other";
  const days = sub.next_renewal_date ? daysUntil(sub.next_renewal_date) : null;
  const isPaymentFailed = sub.status === "payment_failed";
  const sourceEmails = parseSourceEmails(sub.source_email_id);

  return (
    <article className={`flex min-h-72 flex-col rounded-2xl border bg-white p-5 shadow-sm ${isPaymentFailed ? "border-red-300" : "border-stone-200"}`}>
      {isPaymentFailed && (
        <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          Payment failed - update billing info
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold tracking-tight text-stone-950">
          {sub.service_name}
        </h3>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.other}`}>
          {cat}
        </span>
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight">
          {formatMoney(sub.amount ?? 0, sub.currency ?? HOME_CURRENCY)}
        </span>
        <span className="text-sm text-stone-500">/ {sub.billing_cycle ?? "unknown"}</span>
      </div>

      <dl className="mt-5 space-y-2 text-sm text-stone-600">
        <div className="flex justify-between">
          <dt>Next renewal</dt>
          <dd className="font-medium text-stone-900">
            {sub.next_renewal_date
              ? `${sub.next_renewal_date}${days !== null ? ` · ${days}d` : ""}`
              : "Unknown"}
          </dd>
        </div>
        {sub.email_used && (
          <div className="flex justify-between">
            <dt>Account</dt>
            <dd className="truncate pl-4">{sub.email_used}</dd>
          </div>
        )}
      </dl>

      {sub.cancellation_link && (
        <a
          href={sub.cancellation_link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center justify-center rounded-full border border-stone-300 px-3 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-50"
        >
          Cancel subscription
        </a>
      )}

      {sourceEmails.length > 0 && (
        <details className="group mt-auto pt-5">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-stone-500 select-none hover:text-stone-800">
            <span className="inline-block transition-transform group-open:rotate-90">▶</span>
            {sourceEmails.length} source email{sourceEmails.length !== 1 ? "s" : ""}
          </summary>
          <ul className="mt-2 space-y-2 border-t border-stone-100 pt-2">
            {sourceEmails.map((email) => (
              <li key={email.id} className="rounded-xl bg-stone-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                    {EVENT_TYPE_LABEL[email.event_type] ?? "Email"}
                  </span>
                  {email.amount != null && (
                    <span className="text-[10px] text-stone-500">{formatMoney(email.amount, sub.currency ?? HOME_CURRENCY)}</span>
                  )}
                </div>
                <p className="mt-1 text-xs font-medium leading-snug text-stone-800">
                  {email.subject || "(no subject)"}
                </p>
                <p className="truncate text-[10px] text-stone-500">{email.from}</p>
                <p className="text-[10px] text-stone-400">{email.date.slice(0, 16)}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}
