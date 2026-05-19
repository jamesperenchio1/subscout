"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Sub {
  id: string;
  service_brand: string;
  amount: number | null;
  currency: string | null;
  billing_cycle: string | null;
  next_renewal_date: string | null;
  category: string | null;
  status: string;
}

interface Props {
  sub: Sub;
  onClose: () => void;
}

const INPUT =
  "w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400";

export function EditSubscriptionModal({ sub, onClose }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    brand_name: sub.service_brand,
    amount: sub.amount?.toString() ?? "",
    currency: sub.currency ?? "USD",
    billing_cycle: sub.billing_cycle ?? "unknown",
    next_renewal_date: sub.next_renewal_date ?? "",
    category: sub.category ?? "other",
    status: sub.status,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/subscriptions/${sub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_name: form.brand_name || undefined,
          amount: form.amount ? parseFloat(form.amount) : undefined,
          currency: form.currency || undefined,
          billing_cycle: form.billing_cycle || undefined,
          next_renewal_date: form.next_renewal_date || undefined,
          category: form.category || undefined,
          status: form.status || undefined,
        }),
      });
      if (!res.ok) {
        setError((await res.text()) || "Failed to save");
        return;
      }
      router.refresh();
      onClose();
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
          <h2 className="text-base font-semibold">Edit subscription</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 text-lg leading-none">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Name">
            <input
              type="text"
              value={form.brand_name}
              onChange={(e) => set("brand_name", e.target.value)}
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
                onChange={(e) => set("amount", e.target.value)}
                className={INPUT}
              />
            </Field>
            <Field label="Currency">
              <select
                value={form.currency}
                onChange={(e) => set("currency", e.target.value)}
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
          <Field label="Billing cycle">
            <select
              value={form.billing_cycle}
              onChange={(e) => set("billing_cycle", e.target.value)}
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
              onChange={(e) => set("category", e.target.value)}
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
          <Field label="Status">
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
              className={INPUT}
            >
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="payment_failed">Payment failed</option>
              <option value="canceled">Canceled</option>
              <option value="possible">Possible</option>
            </select>
          </Field>
          <Field label="Next renewal date">
            <input
              type="date"
              value={form.next_renewal_date}
              onChange={(e) => set("next_renewal_date", e.target.value)}
              className={INPUT}
            />
          </Field>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
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
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
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
