// Shown instead of the whole app when it is running in production with no
// APP_PASSCODE (see `appIsFailClosed` in lib/auth.ts). Deliberately a plain
// server component: no client JS, no data access, nothing that needs a session.
// It explains exactly what to do, because the owner may be reading it on a phone.
export default function SetupRequired() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6 py-10 pt-safe pb-safe pl-safe pr-safe">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
        Set a passcode to start Remarkabler
      </h1>
      <p className="text-sm text-slate-700 dark:text-slate-300">
        This app holds a private diary, and your hosted address is public. To
        keep it from being open to anyone with the link, it stays locked until
        you choose a passcode.
      </p>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700 dark:text-slate-300">
        <li>
          In your host (for example Railway), open this service&rsquo;s{" "}
          <strong>Variables</strong>.
        </li>
        <li>
          Add <code>APP_PASSCODE</code> and set it to a passcode only you know.
        </li>
        <li>Redeploy, then reload this page.</li>
      </ol>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Running it on purpose without a lock (for example behind a VPN)? Set{" "}
        <code>ALLOW_OPEN_APP=true</code> instead. Not recommended on a public
        address.
      </p>
    </main>
  );
}
