"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DismissReason = "one_time" | "wrong_merchant" | "duplicate" | "not_mine";

const REASON_LABELS: Record<DismissReason, string> = {
  one_time: "This was a one-time purchase, not a subscription",
  wrong_merchant: "Wrong merchant — it's actually:",
  duplicate: "This is a duplicate of another subscription",
  not_mine: "This isn't my purchase",
};

interface Props {
  subId: string;
  subName: string;
  onClose: () => void;
}

export function DismissSubscriptionModal({ subId, subName, onClose }: Props) {
  const router = useRouter();
  const [reason, setReason] = useState<DismissReason>("one_time");
  const [canonicalBrand, setCanonicalBrand] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch(`/api/subscriptions/${subId}/dismiss`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          canonical_brand: reason === "wrong_merchant" ? canonicalBrand : undefined,
        }),
      });
      router.refresh();
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-base font-semibold">Dismiss &ldquo;{subName}&rdquo;</h2>
        <p className="mt-1 text-sm text-stone-500">Why are you dismissing this?</p>
        <form onSubmit={handleSubmit} className="mt-4">
          <div className="space-y-2.5">
            {(["one_time", "wrong_merchant", "duplicate", "not_mine"] as DismissReason[]).map(
              (r) => (
                <label key={r} className="flex cursor-pointer items-start gap-3">
                  <input
                    type="radio"
                    name="reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className="mt-0.5 shrink-0"
                  />
                  <span className="text-sm text-stone-800">{REASON_LABELS[r]}</span>
                </label>
              ),
            )}
          </div>
          {reason === "wrong_merchant" && (
            <div className="ml-6 mt-2">
              <input
                type="text"
                placeholder="Correct merchant name…"
                value={canonicalBrand}
                onChange={(e) => setCanonicalBrand(e.target.value)}
                autoFocus
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
            </div>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                submitting || (reason === "wrong_merchant" && !canonicalBrand.trim())
              }
              className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-50"
            >
              {submitting ? "Dismissing…" : "Dismiss"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
