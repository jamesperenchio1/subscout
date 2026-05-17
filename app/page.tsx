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
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 dark:bg-black">
      <main className="w-full max-w-xl space-y-10 py-24">
        <div className="space-y-4 text-center">
          <p className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium uppercase tracking-wider text-emerald-800">
            SubScout
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
            Find every subscription hiding in your inbox.
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            Connect Gmail. We scan the last 12 months of billing emails and build a live
            dashboard of what you&apos;re actually paying for. Email content is never stored.
          </p>
        </div>

        <form action={connect} className="flex flex-col items-center gap-3">
          <button
            type="submit"
            className="inline-flex h-12 items-center justify-center gap-3 rounded-full bg-zinc-900 px-6 text-base font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            <GoogleMark />
            Connect Gmail
          </button>
          <p className="text-xs text-zinc-500">
            Read-only access. We only look at billing &amp; receipt emails.
          </p>
        </form>

        <ul className="grid grid-cols-1 gap-3 text-sm text-zinc-600 dark:text-zinc-400 sm:grid-cols-3">
          <li className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <span className="font-semibold text-zinc-900 dark:text-zinc-50">1.</span> Sign in with Google
          </li>
          <li className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <span className="font-semibold text-zinc-900 dark:text-zinc-50">2.</span> We scan billing emails
          </li>
          <li className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <span className="font-semibold text-zinc-900 dark:text-zinc-50">3.</span> See your subs &amp; spend
          </li>
        </ul>

        <p className="text-center text-xs text-zinc-500">
          <Link href="/privacy" className="underline-offset-2 hover:underline">Privacy</Link>
        </p>
      </main>
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
