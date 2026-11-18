"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

/** Saved in this browser only: the secret token is what lets THIS device set the new password. */
const STORAGE_KEY = "seo-studio:password-reset";
type Saved = { token: string; code: string; email: string };
type Status = "pending" | "approved" | "denied" | "used" | "expired";

export function loadSavedReset(): Saved | null {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return v && typeof v.token === "string" && typeof v.code === "string" && typeof v.email === "string" ? v : null;
  } catch {
    return null;
  }
}
function save(v: Saved | null) {
  try {
    if (v) localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode: the flow still works while this tab stays open */
  }
}

async function post<T>(url: string, body: unknown): Promise<{ ok: boolean; data: T & { error?: string } }> {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { ok: r.ok, data: await r.json().catch(() => ({})) };
}

/**
 * Forgot password without email: request → admin checks the code and approves → pick a new password
 * on this same device. The page polls while waiting, so it updates by itself once approved.
 */
export function ForgotPassword({ next, minPassword, maxPassword, onBack, initial }: {
  next: string; minPassword: number; maxPassword: number; onBack: () => void; initial: Saved | null;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState<Saved | null>(initial);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("pending");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async (token: string) => {
    const { ok, data } = await post<{ status: Status }>("/api/password-reset/status", { token });
    if (ok) setStatus(data.status);
  }, []);

  useEffect(() => {
    if (!saved || status !== "pending") return;
    const token = saved.token;
    const first = setTimeout(() => check(token), 0);
    const id = setInterval(() => check(token), 5000);
    const onFocus = () => check(token);
    window.addEventListener("focus", onFocus);
    return () => { clearTimeout(first); clearInterval(id); window.removeEventListener("focus", onFocus); };
  }, [saved, status, check]);

  async function request(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { ok, data } = await post<{ token: string; code: string }>("/api/password-reset", { email: email.trim() });
    setBusy(false);
    if (!ok) return setError(data.error ?? "Couldn't send the request.");
    const v = { token: data.token, code: data.code, email: email.trim() };
    save(v);
    setStatus("pending");
    setSaved(v);
  }

  async function complete(e: React.FormEvent) {
    e.preventDefault();
    if (!saved) return;
    setBusy(true);
    setError(null);
    const { ok, data } = await post<{ email: string }>("/api/password-reset/complete", { token: saved.token, password });
    if (!ok) {
      setBusy(false);
      return setError(data.error ?? "Couldn't set the password.");
    }
    save(null);
    const res = await authClient.signIn.email({ email: data.email, password });
    if (res.error) {
      setBusy(false);
      return setError("Password changed. Please sign in with it.");
    }
    router.push(next);
    router.refresh();
  }

  function startOver() {
    save(null);
    setSaved(null);
    setStatus("pending");
    setError(null);
  }

  return (
    <div className="space-y-4">
      <h2 className="text-base font-medium">Reset your password</h2>

      {!saved && (
        <form onSubmit={request} className="space-y-3">
          <p className="text-sm text-muted">Enter your account email. An admin approves the reset, then you choose a new password here.</p>
          <div>
            <label className="label" htmlFor="reset-email">Email</label>
            <input id="reset-email" type="email" className="input" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@uw.edu" />
          </div>
          {error && <p className="rounded-lg bg-fail/10 p-2 text-sm text-fail" role="alert">{error}</p>}
          <button className="btn w-full" disabled={busy}>{busy ? "Sending…" : "Request reset"}</button>
        </form>
      )}

      {saved && status === "pending" && (
        <div className="space-y-3 text-sm">
          <p className="text-muted">Request sent for <b className="text-foreground break-all">{saved.email}</b>. Send this code to an admin so they know it&apos;s really you:</p>
          <div className="rounded-xl bg-surface-2 py-3 text-center font-mono text-3xl font-semibold tracking-[0.3em]">{saved.code}</div>
          <p className="text-muted">Keep this page open (or come back on this same device). It updates by itself once they approve.</p>
          <p className="flex items-center gap-2 text-xs text-subtle"><span className="h-2 w-2 animate-pulse rounded-full bg-warn" />Waiting for approval…</p>
          <button type="button" className="text-xs text-subtle underline hover:text-foreground" onClick={startOver}>Cancel this request</button>
        </div>
      )}

      {saved && status === "approved" && (
        <form onSubmit={complete} className="space-y-3">
          <p className="rounded-lg bg-pass/10 p-2 text-sm text-pass">Approved. Choose a new password for {saved.email}.</p>
          <div>
            <label className="label" htmlFor="reset-password">New password</label>
            <input id="reset-password" type="password" className="input" autoComplete="new-password" required minLength={minPassword} maxLength={maxPassword} value={password} onChange={(e) => setPassword(e.target.value)} />
            <p className="mt-1 text-xs text-subtle">At least {minPassword} characters.</p>
          </div>
          {error && <p className="rounded-lg bg-fail/10 p-2 text-sm text-fail" role="alert">{error}</p>}
          <button className="btn w-full" disabled={busy}>{busy ? "Saving…" : "Save and sign in"}</button>
        </form>
      )}

      {saved && (status === "denied" || status === "expired" || status === "used") && (
        <div className="space-y-3 text-sm">
          <p className="rounded-lg bg-fail/10 p-2 text-fail">
            {status === "denied" ? "This request was declined or replaced by a newer one." : status === "expired" ? "This request expired." : "This request was already used."}
          </p>
          <button type="button" className="btn w-full" onClick={startOver}>Request a new reset</button>
        </div>
      )}

      <button type="button" className="w-full text-center text-xs text-subtle hover:text-foreground" onClick={onBack}>← Back to sign in</button>
    </div>
  );
}
