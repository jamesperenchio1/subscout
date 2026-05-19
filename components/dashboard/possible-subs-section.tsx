"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/format";
import { EditSubscriptionModal } from "@/components/subscription-edit-modal";
import { DismissSubscriptionModal } from "@/components/subscription-dismiss-modal";

interface PossibleSub {
  id: string;
  service_brand: string;
  payment_source: string;
  amount: number | null;
  currency: string | null;
  billing_cycle: string | null;
  brand_logo_url: string | null;
  category: string | null;
  next_renewal_date: string | null;
  status: string;
}

interface EvidenceEmail {
  id: string;
  subject: string | null;
  sender_email: string | null;
  sent_at: string | null;
  gmail_message_id: string | null;
  amount: number | null;
  currency: string | null;
  snippet: string | null;
}

function EvidenceToggle({ subId }: { subId: string }) {
  const [show, setShow] = useState(false);
  const [emails, setEmails] = useState<EvidenceEmail[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (show) { setShow(false); return; }
    setShow(true);
    if (emails !== null) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/subscriptions/${subId}/evidence`);
      const data = await res.json();
      setEmails(data.emails ?? []);
    } catch { setEmails([]); }
    finally { setLoading(false); }
  }

  return (
    <div>
      <button onClick={toggle} className="mt-2 text-xs font-medium text-stone-400 hover:text-stone-700">
        {show ? "Hide proof" : "See proof →"}
      </button>
      {show && (
        <div className="mt-2 space-y-1.5">
          {loading && <p className="text-xs text-stone-400">Loading…</p>}
          {!loading && emails?.length === 0 && <p className="text-xs text-stone-400">No emails found.</p>}
          {emails?.map((em) => (
            <div key={em.id} className="rounded-lg border border-stone-100 bg-stone-50 p-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-stone-800 line-clamp-1">{em.subject ?? "(no subject)"}</p>
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
              <p className="text-[10px] text-stone-400">
                {em.sender_email} · {em.sent_at ? new Date(em.sent_at).toLocaleDateString() : "?"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PossibleSubCard({ sub }: { sub: PossibleSub }) {
  const [showDismiss, setShowDismiss] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  return (
    <>
      {showDismiss && (
        <DismissSubscriptionModal
          subId={sub.id}
          subName={sub.service_brand}
          onClose={() => setShowDismiss(false)}
        />
      )}
      {showEdit && (
        <EditSubscriptionModal sub={sub} onClose={() => setShowEdit(false)} />
      )}
      <article className="rounded-2xl bg-white p-4">
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
              {sub.amount != null
                ? formatMoney(sub.amount, sub.currency ?? "USD")
                : "Unknown amount"}{" "}
              · {sub.billing_cycle ?? "cycle unknown"}
            </p>
          </div>
          <button
            onClick={() => setShowEdit(true)}
            title="Edit"
            className="shrink-0 rounded-full p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
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
          <button
            onClick={() => setShowDismiss(true)}
            className="flex-1 rounded-full border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
          >
            ✗ Dismiss
          </button>
        </div>
        <EvidenceToggle subId={sub.id} />
      </article>
    </>
  );
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
          <PossibleSubCard key={sub.id} sub={sub} />
        ))}
      </div>
    </section>
  );
}
