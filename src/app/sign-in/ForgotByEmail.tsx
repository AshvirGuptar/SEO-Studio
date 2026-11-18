"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/client";

/** Classic "Forgot password?": emails a one-time reset link (used when SMTP is configured). */
export function ForgotByEmail({ onBack, minutes }: { onBack: () => void; minutes: number }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await authClient.requestPasswordReset({ email: email.trim(), redirectTo: "/reset-password" });
    setBusy(false);
    if (res.error) {
      return setError(res.error.status === 429 ? "Too many requests. Please wait a few minutes and try again." : "Couldn't send the email. Please try again later or ask an admin.");
    }
    setSent(true);
  }

  return (
    <div className="space-y-4">
      <h2 className="text-base font-medium">Reset your password</h2>
      {sent ? (
        <div className="space-y-3 text-sm">
          <p className="rounded-lg bg-pass/10 p-3 text-pass" role="status">
            If an account exists for <b className="break-all">{email.trim()}</b>, we&apos;ve emailed it a reset link.
          </p>
          <p className="text-muted">The link works once and expires in {minutes} minutes. Don&apos;t see it? Check your spam folder.</p>
          <button type="button" className="btn-ghost w-full" onClick={() => setSent(false)}>Send again</button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <p className="text-sm text-muted">Enter your account email and we&apos;ll send you a link to choose a new password.</p>
          <div>
            <label className="label" htmlFor="forgot-email">Email</label>
            <input id="forgot-email" type="email" className="input" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email" />
          </div>
          {error && <p className="rounded-lg bg-fail/10 p-2 text-sm text-fail" role="alert">{error}</p>}
          <button className="btn w-full" disabled={busy}>{busy ? "Sending…" : "Email me a reset link"}</button>
        </form>
      )}
      <button type="button" className="w-full text-center text-xs text-subtle hover:text-foreground" onClick={onBack}>← Back to sign in</button>
    </div>
  );
}
