export function SetupNotice({ feature }: { feature: string }) {
  return (
    <div className="card max-w-2xl">
      <h2 className="font-medium">{feature} needs sign-in to be set up</h2>
      <p className="mt-2 text-sm text-muted">
        Saved data is private to your team, so this feature turns on once Google sign-in and the database are configured.
        An admin sets these environment variables in Vercel (Settings → Environment Variables) and redeploys:
      </p>
      <ul className="mt-3 space-y-1 font-mono text-xs text-muted">
        <li>DATABASE_URL <span className="text-subtle">(added by the Neon integration)</span></li>
        <li>BETTER_AUTH_SECRET</li>
        <li>GOOGLE_CLIENT_ID · GOOGLE_CLIENT_SECRET</li>
        <li>ADMIN_EMAILS <span className="text-subtle">(optional: AUTO_APPROVE_DOMAINS)</span></li>
      </ul>
      <p className="mt-3 text-sm text-muted">See the README&apos;s “Sign-in setup” section for step-by-step instructions.</p>
    </div>
  );
}
