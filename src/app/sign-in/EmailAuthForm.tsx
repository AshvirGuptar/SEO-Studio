"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { ForgotPassword, loadSavedReset } from "./ForgotPassword";
import { ForgotByEmail } from "./ForgotByEmail";

type Mode = "signin" | "signup";

/** Turns Better Auth error codes/statuses into plain-English messages. */
function explain(error: { status?: number; code?: string; message?: string } | null | undefined, mode: Mode): string {
  if (!error) return "Something went wrong. Please try again.";
  if (error.status === 429) return "Too many attempts. Please wait a minute and try again.";
  const code = error.code ?? "";
  if (code.includes("INVALID_EMAIL_OR_PASSWORD") || code.includes("INVALID_PASSWORD")) return "That email and password don't match.";
  if (code.includes("USER_ALREADY_EXISTS")) return "An account with that email already exists. Sign in instead.";
  if (code.includes("PASSWORD_TOO_SHORT")) return "That password is too short.";
  if (code.includes("PASSWORD_TOO_LONG")) return "That password is too long.";
  if (code.includes("INVALID_EMAIL")) return "Please enter a valid email address.";
  return error.message || (mode === "signup" ? "Couldn't create the account." : "Couldn't sign in.");
}

/** `emailReset`: "Forgot password?" emails a link (minutes = link lifetime); otherwise admin-approved reset. */
export function EmailAuthForm({ next, initialMode, minPassword, maxPassword, emailReset, resetMinutes }: {
  next: string; initialMode: Mode; minPassword: number; maxPassword: number; emailReset: boolean; resetMinutes: number;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgot, setForgot] = useState<{ open: boolean; saved: ReturnType<typeof loadSavedReset> }>({ open: false, saved: null });

  // Came back to finish a reset on this device: reopen it.
  useEffect(() => {
    const saved = emailReset ? null : loadSavedReset();
    if (saved) setTimeout(() => setForgot({ open: true, saved }), 0);
  }, [emailReset]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res =
      mode === "signup"
        ? await authClient.signUp.email({ name: name.trim() || email.split("@")[0], email: email.trim(), password })
        : await authClient.signIn.email({ email: email.trim(), password });
    if (res.error) {
      setError(explain(res.error, mode));
      setBusy(false);
      return;
    }
    // Signed in. Approved users land in the app; pending users see the "Access requested" screen.
    router.push(next);
    router.refresh();
  }

  if (forgot.open && emailReset) return <ForgotByEmail minutes={resetMinutes} onBack={() => setForgot({ open: false, saved: null })} />;
  if (forgot.open) {
    return <ForgotPassword next={next} minPassword={minPassword} maxPassword={maxPassword} initial={forgot.saved}
      onBack={() => setForgot({ open: false, saved: null })} />;
  }

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1" role="tablist">
        {(["signin", "signup"] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m}
            onClick={() => { setMode(m); setError(null); }}
            className={`min-h-9 rounded-lg text-sm transition ${mode === m ? "bg-surface font-medium text-foreground shadow" : "text-muted hover:text-foreground"}`}>
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-3">
        {mode === "signup" && (
          <div>
            <label className="label" htmlFor="auth-name">Name</label>
            <input id="auth-name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={80} />
          </div>
        )}
        <div>
          <label className="label" htmlFor="auth-email">Email</label>
          <input id="auth-email" type="email" className="input" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@uw.edu" />
        </div>
        <div>
          <label className="label" htmlFor="auth-password">Password</label>
          <div className="relative">
            <input id="auth-password" type={show ? "text" : "password"} className="input pr-16" required
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={mode === "signup" ? minPassword : undefined} maxLength={maxPassword}
              value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" onClick={() => setShow(!show)} className="absolute inset-y-0 right-2 my-auto h-8 rounded-md px-2 text-xs text-muted hover:text-foreground"
              aria-label={show ? "Hide password" : "Show password"}>{show ? "Hide" : "Show"}</button>
          </div>
          {mode === "signup" && <p className="mt-1 text-xs text-subtle">At least {minPassword} characters.</p>}
        </div>
        {error && <p className="rounded-lg bg-fail/10 p-2 text-sm text-fail" role="alert">{error}</p>}
        <button className="btn w-full" disabled={busy}>
          {busy ? (mode === "signup" ? "Creating account…" : "Signing in…") : mode === "signup" ? "Create account" : "Sign in"}
        </button>
        {mode === "signin" && (
          <button type="button" className="mx-auto block min-h-8 text-xs text-subtle hover:text-foreground" onClick={() => setForgot({ open: true, saved: null })}>Forgot password?</button>
        )}
      </form>
    </div>
  );
}
