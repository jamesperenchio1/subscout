"use client";

/**
 * Integration hint:
 * To open this modal from a subscription card or the edit modal, import and
 * render it conditionally in the parent component. For example:
 *
 *   const [feedbackOpen, setFeedbackOpen] = useState(false);
 *   // ...
 *   <button onClick={() => setFeedbackOpen(true)}>Report issue</button>
 *   {feedbackOpen && (
 *     <FeedbackModal sub={sub} onClose={() => setFeedbackOpen(false)} />
 *   )}
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Sub {
  id: string;
  service_brand: string;
  amount: number | null;
  currency: string | null;
  billing_cycle: string | null;
  category: string | null;
  status: string;
}

interface Props {
  sub: Sub;
  onClose: () => void;
}

const INPUT =
  "w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400";

export function FeedbackModal({ sub, onClose }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    brand: sub.service_brand,
    amount: sub.amount?.toString() ?? "",
    currency: sub.currency ?? "USD",
    cycle: sub.billing_cycle ?? "monthly",
    category: sub.category ?? "other",
    status: sub.status,
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function setField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(flagForReview = false) {
    setSaving(true);
    setError(null);

    const body: Record<string, unknown> = {
      notes: form.notes || undefined,
      flag_for_review: flagForReview,
    };

    if (form.brand.trim() && form.brand.trim() !== sub.service_brand) {
      body.brand = form.brand.trim();
    }
    if (form.amount) {
      const num = parseFloat(form.amount);
      if (!Number.isNaN(num) && num !== sub.amount) {
        body.amount = num;
      }
    }
    if (form.currency && form.currency !== sub.currency) {
      body.currency = form.currency;
    }
    if (form.cycle && form.cycle !== sub.billing_cycle) {
      body.cycle = form.cycle;
    }
    if (form.category && form.category !== sub.category) {
      body.category = form.category;
    }
    if (form.status && form.status !== sub.status) {
      body.status = form.status;
    }

    try {
      const res = await fetch(`/api/subscriptions/${sub.id}/correct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError((await res.text()) || "Failed to save correction");
        return;
      }
      setSuccess(true);
      router.refresh();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Correct subscription</h2>
          <button
            onClick={onClose}
            className="text-lg leading-none text-stone-400 hover:text-stone-700"
            type="button"
          >
            ✕
          </button>
        </div>

        {success ? (
          <div className="rounded-lg bg-green-50 p-4 text-center text-sm text-green-700">
            Thanks — your correction has been saved.
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit(false);
            }}
            className="space-y-3"
          >
            <Field label="Brand / name">
              <input
                type="text"
                value={form.brand}
                onChange={(e) => setField("brand", e.target.value)}
                className={INPUT}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={(e) => setField("amount", e.target.value)}
                  className={INPUT}
                />
              </Field>
              <Field label="Currency">
                <select
                  value={form.currency}
                  onChange={(e) => setField("currency", e.target.value)}
                  className={INPUT}
                >
                  <option>USD</option>
                  <option>EUR</option>
                  <option>GBP</option>
                  <option>THB</option>
                  <option>JPY</option>
                  <option>SGD</option>
                  <option>AUD</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Billing cycle">
                <select
                  value={form.cycle}
                  onChange={(e) => setField("cycle", e.target.value)}
                  className={INPUT}
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">Annual</option>
                  <option value="unknown">Unknown</option>
                </select>
              </Field>
              <Field label="Category">
                <select
                  value={form.category}
                  onChange={(e) => setField("category", e.target.value)}
                  className={INPUT}
                >
                  <option value="entertainment">Entertainment</option>
                  <option value="saas">SaaS</option>
                  <option value="health">Health</option>
                  <option value="food">Food</option>
                  <option value="finance">Finance</option>
                  <option value="utilities">Utilities</option>
                  <option value="other">Other</option>
                </select>
              </Field>
            </div>

            <Field label="Status">
              <select
                value={form.status}
                onChange={(e) => setField("status", e.target.value)}
                className={INPUT}
              >
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="payment_failed">Payment failed</option>
                <option value="canceled">Canceled</option>
                <option value="possible">Possible</option>
              </select>
            </Field>

            <Field label="Notes (optional)">
              <textarea
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                rows={3}
                className={INPUT}
                placeholder="Why is this wrong?"
              />
            </Field>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleSubmit(true)}
                disabled={saving}
                className="rounded-full border border-amber-300 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Flag for review"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save correction"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-stone-600">{label}</label>
      {children}
    </div>
  );
}
