"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface NeedsReviewEmail {
  id: string;
  subject: string | null;
  sender_email: string | null;
  sent_at: string | null;
  source_email: string | null;
  pdf_attachments: { filename: string; sizeBytes: number; status: string }[];
}

interface Props {
  emails: NeedsReviewEmail[];
}

function NeedsReviewCard({ email, onDismiss }: { email: NeedsReviewEmail; onDismiss: (id: string) => void }) {
  const [dismissing, setDismissing] = useState(false);

  async function dismiss() {
    setDismissing(true);
    try {
      await fetch(`/api/emails/${email.id}/dismiss`, { method: "POST" });
      onDismiss(email.id);
    } finally {
      setDismissing(false);
    }
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-stone-900">
            {email.subject ?? "(no subject)"}
          </p>
          <p className="mt-0.5 text-xs text-stone-500">
            {email.sender_email}
            {email.sent_at ? ` · ${new Date(email.sent_at).toLocaleDateString()}` : ""}
            {email.source_email ? ` · ${email.source_email}` : ""}
          </p>
        </div>
        <button
          onClick={dismiss}
          disabled={dismissing}
          className="shrink-0 rounded-full p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600 disabled:opacity-50"
          title="Dismiss"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      {email.pdf_attachments.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {email.pdf_attachments.map((att, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
              {att.filename}
            </span>
          ))}
        </div>
      )}
      <p className="mt-1.5 text-[10px] text-stone-400">
        PDF contains only scanned images — text could not be extracted automatically.
      </p>
    </div>
  );
}

export function NeedsReviewSection({ initialEmails }: { initialEmails: NeedsReviewEmail[] }) {
  const [emails, setEmails] = useState(initialEmails);
  const router = useRouter();

  function dismiss(id: string) {
    setEmails((prev) => prev.filter((e) => e.id !== id));
    router.refresh();
  }

  if (emails.length === 0) return null;

  return (
    <section className="rounded-[2rem] border border-orange-200 bg-orange-50 p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-700">Scanned PDFs</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-stone-900">Needs review</h2>
          <p className="mt-2 text-sm text-stone-700">
            These emails have invoice PDFs that are image-based and couldn&apos;t be read automatically.
            Check them manually and dismiss if not relevant.
          </p>
        </div>
        <p className="shrink-0 text-sm text-orange-800">{emails.length} to review</p>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {emails.map((email) => (
          <NeedsReviewCard key={email.id} email={email} onDismiss={dismiss} />
        ))}
      </div>
    </section>
  );
}
