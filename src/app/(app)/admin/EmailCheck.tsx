"use client";

import { useState } from "react";

/** Shows whether password-reset emails are on, with a button that sends a test to the admin. */
export function EmailCheck({ sender }: { sender: string | null }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function test() {
    setBusy(true);
    setResult(null);
    const r = await fetch("/api/admin/email-test", { method: "POST" }).catch(() => null);
    const data = await r?.json().catch(() => ({}));
    setBusy(false);
    if (r?.ok) setResult({ ok: true, text: `Sent to ${data.to}. Check that inbox (and spam).` });
    else setResult({ ok: false, text: data?.error ?? "Couldn't reach the server." });
  }

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 text-sm">
          <h2 className="font-medium">Password-reset emails</h2>
          {sender ? (
            <p className="mt-1 text-muted">On. &ldquo;Forgot password?&rdquo; emails a reset link from <b className="break-all text-foreground">{sender}</b>.</p>
          ) : (
            <p className="mt-1 text-muted">
              Off: SMTP_USER and SMTP_PASSWORD aren&apos;t set, so &ldquo;Forgot password?&rdquo; uses codes you approve here instead.
            </p>
          )}
        </div>
        {sender && <button className="btn-ghost" onClick={test} disabled={busy}>{busy ? "Sending…" : "Send test email"}</button>}
      </div>
      {result && (
        <p className={`mt-3 rounded-lg p-2 text-sm ${result.ok ? "bg-pass/10 text-pass" : "bg-fail/10 text-fail"}`} role="status">{result.text}</p>
      )}
    </div>
  );
}
