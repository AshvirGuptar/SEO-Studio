"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/client";

export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
    setBusy(false);
    if (res.error) {
      const text = res.error.status === 429 ? "Too many attempts. Please wait a minute."
        : (res.error.code ?? "").includes("INVALID_PASSWORD") ? "Your current password is incorrect."
        : (res.error.code ?? "").includes("PASSWORD_TOO_SHORT") ? "The new password is too short (8+ characters)."
        : (res.error.code ?? "").includes("CREDENTIAL_ACCOUNT_NOT_FOUND") ? "This account signs in with Google, so it has no password to change."
        : res.error.message || "Couldn't change the password.";
      return setMsg({ ok: false, text });
    }
    setCurrent("");
    setNext("");
    setMsg({ ok: true, text: "Password changed. Other devices were signed out." });
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <h2 className="font-medium">Change password</h2>
      <div>
        <label className="label" htmlFor="pw-current">Current password</label>
        <input id="pw-current" type="password" className="input" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="pw-new">New password</label>
        <input id="pw-new" type="password" className="input" autoComplete="new-password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} />
        <p className="mt-1 text-xs text-subtle">At least 8 characters.</p>
      </div>
      {msg && <p className={`rounded-lg p-2 text-sm ${msg.ok ? "bg-pass/10 text-pass" : "bg-fail/10 text-fail"}`} role="status">{msg.text}</p>}
      <button className="btn" disabled={busy}>{busy ? "Saving…" : "Change password"}</button>
    </form>
  );
}
