export default function Privacy() {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-6 py-16 text-zinc-700 dark:text-zinc-300">
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">Privacy</h1>
      <p>
        SubScout reads your Gmail in order to detect subscription, billing, and receipt emails.
        We only request <code>gmail.readonly</code> access.
      </p>
      <p>
        <strong>Email content is never stored.</strong> We extract a small set of fields
        (service name, amount, billing cycle, renewal date) and store only those fields in our
        database. The original email body is discarded as soon as extraction completes.
      </p>
      <p>
        Your Google refresh token is encrypted at rest with AES-256-GCM and only decrypted in
        memory to call the Gmail API.
      </p>
      <p>
        You can delete all your data at any time by signing in and removing your account.
      </p>
    </main>
  );
}
