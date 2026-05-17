import { formatMoney, daysUntil } from "@/lib/format";
import { parseSourceEmails } from "@/lib/scan";

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
  entertainment: "bg-purple-100 text-purple-800",
  saas: "bg-blue-100 text-blue-800",
  health: "bg-rose-100 text-rose-800",
  food: "bg-orange-100 text-orange-800",
  finance: "bg-emerald-100 text-emerald-800",
  utilities: "bg-amber-100 text-amber-800",
  other: "bg-zinc-100 text-zinc-800",
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
    <article className={`flex flex-col rounded-xl border p-5 bg-white dark:bg-zinc-950 ${isPaymentFailed ? "border-red-300 dark:border-red-800" : "border-zinc-200 dark:border-zinc-800"}`}>
      {isPaymentFailed && (
        <div className="mb-3 rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-400">
          ⚠ Payment failed — update billing info
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {sub.service_name}
        </h3>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.other}`}>
          {cat}
        </span>
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight">
          {formatMoney(sub.amount ?? 0, sub.currency ?? "USD")}
        </span>
        <span className="text-sm text-zinc-500">/ {sub.billing_cycle ?? "unknown"}</span>
      </div>

      <dl className="mt-4 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
        <div className="flex justify-between">
          <dt>Next renewal</dt>
          <dd>
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
          className="mt-4 inline-flex items-center justify-center rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Cancel subscription
        </a>
      )}

      {sourceEmails.length > 0 && (
        <details className="mt-4 group">
          <summary className="cursor-pointer list-none text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 flex items-center gap-1 select-none">
            <span className="inline-block transition-transform group-open:rotate-90">▶</span>
            {sourceEmails.length} source email{sourceEmails.length !== 1 ? "s" : ""}
          </summary>
          <ul className="mt-2 space-y-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
            {sourceEmails.map((email) => (
              <li key={email.id} className="rounded-md bg-zinc-50 p-2 dark:bg-zinc-900">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                    {EVENT_TYPE_LABEL[email.event_type] ?? "Email"}
                  </span>
                  {email.amount != null && (
                    <span className="text-[10px] text-zinc-500">${email.amount}</span>
                  )}
                </div>
                <p className="mt-0.5 text-xs font-medium text-zinc-800 dark:text-zinc-200 leading-snug">
                  {email.subject || "(no subject)"}
                </p>
                <p className="text-[10px] text-zinc-500 truncate">{email.from}</p>
                <p className="text-[10px] text-zinc-400">{email.date.slice(0, 16)}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}
