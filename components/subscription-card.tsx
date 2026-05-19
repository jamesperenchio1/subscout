"use client";

import { useState } from "react";
import { formatMoney, daysUntil } from "@/lib/format";
import { EditSubscriptionModal } from "./subscription-edit-modal";

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

interface EvidenceEmail {
  id: string;
  subject: string | null;
  sender_email: string | null;
  sent_at: string | null;
  gmail_message_id: string | null;
  amount: number | null;
  currency: string | null;
  event_type: string | null;
  snippet: string | null;
}

export function SubscriptionCard({ sub }: { sub: Sub }) {
  const cat = sub.category ?? "other";
  const days = sub.next_renewal_date ? daysUntil(sub.next_renewal_date) : null;
  const isFailed = sub.status === "payment_failed";
  const isTrial = sub.status === "trial";

  const [showEvidence, setShowEvidence] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceEmail[] | null>(null);
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  async function toggleEvidence() {
    if (showEvidence) { setShowEvidence(false); return; }
    setShowEvidence(true);
    if (evidence !== null) return;
    setLoadingEvidence(true);
    try {
      const res = await fetch(`/api/subscriptions/${sub.id}/evidence`);
      const data = await res.json();
      setEvidence(data.emails ?? []);
    } catch { setEvidence([]); }
    finally { setLoadingEvidence(false); }
  }

  return (
    <>
    {showEdit && (
      <EditSubscriptionModal sub={sub} onClose={() => setShowEdit(false)} />
    )}
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
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.other}`}>
            {cat}
          </span>
          <button
            onClick={() => setShowEdit(true)}
            title="Edit subscription"
            className="rounded-full p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        </div>
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

      <button
        onClick={toggleEvidence}
        className="mt-3 text-xs font-medium text-stone-400 hover:text-stone-700 text-left"
      >
        {showEvidence ? "Hide proof" : "See proof →"}
      </button>

      {showEvidence && (
        <div className="mt-2 space-y-2">
          {loadingEvidence && <p className="text-xs text-stone-400">Loading…</p>}
          {!loadingEvidence && evidence?.length === 0 && (
            <p className="text-xs text-stone-400">No linked emails found.</p>
          )}
          {evidence?.map((em) => (
            <div key={em.id} className="rounded-xl border border-stone-100 bg-stone-50 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-stone-800 leading-snug line-clamp-2">
                  {em.subject ?? "(no subject)"}
                </p>
                {em.gmail_message_id && (
                  <a
                    href={`https://mail.google.com/mail/u/0/#all/${em.gmail_message_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-[10px] font-semibold text-blue-600 hover:underline"
                  >
                    Open ↗
                  </a>
                )}
              </div>
              <p className="mt-1 text-[10px] text-stone-500">
                {em.sender_email} · {em.sent_at ? new Date(em.sent_at).toLocaleDateString() : "?"}
                {em.amount != null ? ` · ${formatMoney(em.amount, em.currency ?? "USD")}` : ""}
                {em.event_type ? ` · ${em.event_type}` : ""}
              </p>
              {em.snippet && (
                <p className="mt-1 text-[10px] text-stone-400 line-clamp-2">{em.snippet}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </article>
    </>
  );
}
