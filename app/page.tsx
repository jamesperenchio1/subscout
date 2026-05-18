import Link from "next/link";
import { auth, signIn } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  async function connect() {
    "use server";
    await signIn("google", { redirectTo: "/dashboard" });
  }

  return (
    <div className="flex flex-1 flex-col bg-[#f7f4ee] text-stone-950">
      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[1fr_420px] lg:py-16">
        <section className="space-y-8">
          <div className="space-y-5">
            <p className="inline-flex rounded-full border border-stone-300 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-stone-700">
              SubScout
            </p>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
              Find every subscription hiding in your inbox.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-stone-600">
              Connect Gmail once. AI reads every billing signal — receipts, renewals, and charges in any language or currency — and surfaces your active subscriptions without storing raw email content.
            </p>
          </div>

          <form action={connect} className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="submit"
              className="inline-flex h-[52px] items-center justify-center gap-3 rounded-full bg-stone-950 px-6 text-base font-semibold text-white shadow-sm transition-colors hover:bg-stone-800"
            >
              <GoogleMark />
              Connect Gmail
            </button>
            <p className="text-sm text-stone-600">
              Read-only Gmail access. No raw email bodies are stored.
            </p>
          </form>

          <div className="grid gap-3 sm:grid-cols-3">
            <Metric value="2 yr" label="Gmail scan window" />
            <Metric value="AI" label="Powered detection" />
            <Metric value="0" label="Raw emails stored" />
          </div>
        </section>

        <aside className="rounded-[2rem] border border-stone-300 bg-white p-5 shadow-[0_24px_80px_rgba(28,25,23,0.12)]">
          <div className="rounded-[1.5rem] bg-stone-950 p-5 text-white">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-stone-300">Discovery stack</p>
              <span className="rounded-full bg-lime-300 px-2 py-1 text-xs font-bold text-stone-950">live</span>
            </div>
            <div className="mt-8 space-y-4">
              {[
                "Reads receipts and renewals in any language",
                "Detects recurring charge patterns across 2 years",
                "Groups variants of the same service into one card",
                "Flags trials, failed payments, and cancellations",
              ].map((note, index) => (
                <div key={note} className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">
                    {index + 1}
                  </span>
                  <p className="text-sm leading-6 text-stone-200">{note}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-[#f7f4ee] p-4">
              <p className="text-stone-500">Evidence</p>
              <p className="mt-1 font-semibold">Source emails attached</p>
            </div>
            <div className="rounded-2xl bg-lime-100 p-4">
              <p className="text-stone-500">Confidence</p>
              <p className="mt-1 font-semibold">Recurring patterns first</p>
            </div>
          </div>
        </aside>

        <p className="text-sm text-stone-500 lg:col-span-2">
          <Link href="/privacy" className="underline-offset-4 hover:underline">Privacy</Link>
        </p>
      </main>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-stone-300 bg-white/70 p-4">
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-sm text-stone-600">{label}</p>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5h-1.9V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.2-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.7 6.4 29.1 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5c10.8 0 19.5-8.7 19.5-19.5 0-1.2-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.7 6.4 29.1 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 43.5c5 0 9.6-1.9 13-5l-6-5.1c-2 1.4-4.5 2.2-7 2.2-5.3 0-9.7-3.1-11.3-7.5l-6.5 5C9.7 39 16.3 43.5 24 43.5z"/>
      <path fill="#1976D2" d="M43.6 20.5H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.7l6 5.1c-.4.4 6.5-4.7 6.5-15.3 0-1.2-.1-2.3-.4-3.5z"/>
    </svg>
  );
}
