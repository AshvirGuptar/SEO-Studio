/** Shown where saved data is needed but not configured. `signInOnly`: the feature needs real accounts (not open mode). */
export function SetupNotice({ feature, signInOnly = false }: { feature: string; signInOnly?: boolean }) {
  return (
    <div className="card max-w-2xl">
      <h2 className="font-medium">{feature} {signInOnly ? "needs accounts to be turned on" : "needs a database to be connected"}</h2>
      {!signInOnly && (
        <p className="mt-2 text-sm text-muted">
          <b className="text-foreground">Quickest:</b> connect a database in Vercel (Storage → Neon, which sets{" "}
          <code className="font-mono text-xs">DATABASE_URL</code>) and redeploy. Until accounts are turned on, the app then runs in
          open mode: everyone who can reach the site shares one Team account.
        </p>
      )}
      <p className="mt-3 text-sm text-muted">
        {signInOnly ? "Set" : "For private, per-person accounts (email + password), also set"} these environment variables in Vercel (Settings → Environment Variables) and redeploy:
      </p>
      <ul className="mt-3 space-y-1 font-mono text-xs text-muted">
        <li>DATABASE_URL <span className="text-subtle">(added by the Neon integration)</span></li>
        <li>BETTER_AUTH_SECRET <span className="text-subtle">(any long random string)</span></li>
        <li>ADMIN_EMAILS <span className="text-subtle">(your email addresses, comma-separated)</span></li>
      </ul>
      <p className="mt-3 text-sm text-muted">See the README&apos;s “Sign-in setup” section for step-by-step instructions.</p>
    </div>
  );
}
