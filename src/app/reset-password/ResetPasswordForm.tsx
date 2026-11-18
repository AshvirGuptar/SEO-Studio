"use client";

import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";

export function ResetPasswordForm({ token, minPassword, maxPassword }: { token: string; minPassword: number; maxPassword: number }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    setError(null);
    const res = await authClient.resetPassword({ newPassword: password, token });
    setBusy(false);
    if (res.error) {
      const code = res.error.code ?? "";
      return setError(
        res.error.status === 429 ? "Too many attempts. Please wait a few minutes."
          : code.includes("INVALID_TOKEN") ? "This reset link is invalid or has expired. Request a new one from the sign-in page."
          : code.includes("PASSWORD_TOO_SHORT") ? `Use at least ${minPassword} characters.`
          : res.error.message || "Couldn't change the password.",
      );
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="space-y-4 text-sm">
        <p className="rounded-lg bg-pass/10 p-3 text-pass" role="status">Password changed. You were signed out on other devices.</p>
        <Link href="/sign-in" className="btn w-full">Sign in</Link>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="label" htmlFor="new-password">New password</label>
        <input id="new-password" type="password" className="input" autoComplete="new-password" required minLength={minPassword} maxLength={maxPassword} value={password} onChange={(e) => setPassword(e.target.value)} />
        <p className="mt-1 text-xs text-subtle">At least {minPassword} characters.</p>
      </div>
      <div>
        <label className="label" htmlFor="confirm-password">Confirm new password</label>
        <input id="confirm-password" type="password" className="input" autoComplete="new-password" required minLength={minPassword} maxLength={maxPassword} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      {error && <p className="rounded-lg bg-fail/10 p-2 text-sm text-fail" role="alert">{error}</p>}
      <button className="btn w-full" disabled={busy}>{busy ? "Saving…" : "Save new password"}</button>
    </form>
  );
}
