"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface Account {
  id: string;
  google_email: string;
  is_enabled: boolean;
  connection_status: "connected" | "needs_reauth" | "disconnected";
  last_synced_at: string | null;
}

interface Props {
  initialAccounts: Account[];
}

const STATUS_LABEL: Record<Account["connection_status"], string> = {
  connected: "Connected",
  needs_reauth: "Reconnect required",
  disconnected: "Disconnected",
};

function formatRelative(iso: string | null): string {
  if (!iso) return "Never synced";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Synced just now";
  if (m < 60) return `Synced ${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Synced ${h}h ago`;
  const d = Math.floor(h / 24);
  return `Synced ${d}d ago`;
}

export function AccountsPanel({ initialAccounts }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [busy, setBusy] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  useEffect(() => {
    const connected = params.get("connected");
    const error = params.get("error");
    if (connected) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBanner({ kind: "ok", msg: `Connected ${connected}` });
    } else if (error) {
      const msgs: Record<string, string> = {
        not_signed_in: "Please sign in first.",
        invalid_state: "Connection request expired. Try again.",
        state_mismatch: "Security check failed. Try again.",
        no_refresh_token: "Google didn't return a refresh token. Remove app access and retry.",
        no_email: "Couldn't read the email address from Google.",
        oauth_failed: "Google OAuth failed. Try again.",
        db_error: "Database error. Try again.",
      };
      setBanner({ kind: "err", msg: msgs[error] ?? `Error: ${error}` });
    }
    if (connected || error) {
      // Clear query params
      router.replace("/settings");
    }
  }, [params, router]);

  async function refresh() {
    const res = await fetch("/api/gmail-accounts");
    if (res.ok) {
      const data = await res.json();
      setAccounts(data.accounts ?? []);
    }
  }

  async function toggle(account: Account) {
    setBusy(account.id);
    try {
      await fetch(`/api/gmail-accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_enabled: !account.is_enabled }),
      });
      setAccounts((prev) =>
        prev.map((a) => (a.id === account.id ? { ...a, is_enabled: !a.is_enabled } : a)),
      );
    } finally {
      setBusy(null);
    }
  }

  async function remove(account: Account) {
    if (!confirm(`Remove ${account.google_email}? Its emails and any subscriptions only seen in this inbox will be deleted.`)) {
      return;
    }
    setBusy(account.id);
    try {
      const res = await fetch(`/api/gmail-accounts/${account.id}`, { method: "DELETE" });
      if (res.ok) {
        setAccounts((prev) => prev.filter((a) => a.id !== account.id));
        setBanner({ kind: "ok", msg: `Removed ${account.google_email}` });
      } else {
        setBanner({ kind: "err", msg: "Failed to remove account." });
      }
    } finally {
      setBusy(null);
    }
  }

  async function connect() {
    setConnecting(true);
    try {
      const res = await fetch("/api/gmail-accounts/connect");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setConnecting(false);
        setBanner({ kind: "err", msg: "Could not start connection flow." });
      }
    } catch {
      setConnecting(false);
      setBanner({ kind: "err", msg: "Network error starting connection." });
    }
  }

  // Auto-refresh after redirect-back so the new account shows up immediately
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (params.get("connected")) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      {banner && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            banner.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {banner.msg}
        </div>
      )}

      {accounts.length === 0 && (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-500">
          No Gmail accounts connected yet.
        </div>
      )}

      {accounts.map((account) => {
        const isReauth = account.connection_status === "needs_reauth";
        return (
          <div
            key={account.id}
            className={`rounded-2xl border bg-white p-5 ${
              isReauth ? "border-red-300" : "border-stone-200"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-stone-900">
                  {account.google_email}
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  {formatRelative(account.last_synced_at)} ·{" "}
                  <span
                    className={
                      isReauth
                        ? "font-medium text-red-700"
                        : account.is_enabled
                        ? "text-emerald-700"
                        : "text-stone-500"
                    }
                  >
                    {account.is_enabled
                      ? STATUS_LABEL[account.connection_status]
                      : "Disabled"}
                  </span>
                </p>
              </div>
              <ToggleSwitch
                checked={account.is_enabled}
                disabled={busy === account.id}
                onChange={() => toggle(account)}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={connect}
                disabled={busy === account.id || connecting}
                className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50"
              >
                {isReauth ? "Reconnect" : "Re-authenticate"}
              </button>
              <button
                onClick={() => remove(account)}
                disabled={busy === account.id}
                className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          </div>
        );
      })}

      <button
        onClick={connect}
        disabled={connecting}
        className="w-full rounded-2xl border-2 border-dashed border-stone-300 bg-white p-5 text-sm font-semibold text-stone-700 hover:border-stone-400 hover:bg-stone-50 disabled:opacity-50"
      >
        {connecting ? "Redirecting to Google…" : "+ Connect another Gmail account"}
      </button>
    </div>
  );
}

function ToggleSwitch({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors disabled:opacity-50 ${
        checked ? "bg-lime-500" : "bg-stone-300"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
