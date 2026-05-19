import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { AccountsPanel } from "@/components/settings/accounts-panel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !userId) redirect("/");

  const db = supabaseAdmin();
  const { data: accounts } = await db
    .from("gmail_accounts")
    .select("id, google_email, is_enabled, connection_status, last_synced_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  return (
    <div className="flex flex-1 flex-col bg-[#f7f4ee] text-stone-950">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm font-medium text-stone-500 hover:text-stone-900">
              ← Dashboard
            </Link>
            <span className="text-lg font-semibold tracking-tight">Settings</span>
          </div>
          <span className="hidden truncate text-sm text-stone-600 sm:inline">
            {session.user?.email}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-5 py-8 sm:px-8">
        <section>
          <h1 className="text-2xl font-semibold tracking-tight">Connected Gmail accounts</h1>
          <p className="mt-2 text-sm text-stone-600">
            Add multiple inboxes — all your subscriptions are unified into one dashboard. Disable an
            account to skip it on scans without losing its history.
          </p>
        </section>

        <AccountsPanel initialAccounts={accounts ?? []} />
      </main>
    </div>
  );
}
