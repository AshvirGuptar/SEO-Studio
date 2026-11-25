"use client";

import Link from "next/link";
import { useState } from "react";
import { Crown } from "@/components/Crown";
import { scoreColor } from "@/components/ScoreRing";

/** Who can use the AI parts of this tool right now (decided on the server). */
export type AiAccess = "ready" | "no-key" | "read-only" | "signin" | "pending" | "disabled" | "setup";

/** Copies text to the clipboard and says so. */
export function CopyButton({ text, label = "Copy", className = "btn-ghost" }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className={className} onClick={async () => {
      try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { setDone(false); }
    }}>
      {done ? "Copied ✓" : label}
    </button>
  );
}

/** Downloads text as a file (robots.txt, llms.txt, schema.json…). */
export function DownloadButton({ text, filename, label = "Download", type = "text/plain" }: { text: string; filename: string; label?: string; type?: string }) {
  return (
    <button type="button" className="btn-ghost" onClick={() => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([text], { type }));
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }}>
      {label}
    </button>
  );
}

/** Read-only code output that scrolls inside its box on small screens. */
export function CodeBlock({ code, label }: { code: string; label: string }) {
  return (
    <pre aria-label={label} className="max-h-96 overflow-auto rounded-xl border border-border bg-surface-2/50 p-3 font-mono text-xs leading-relaxed whitespace-pre">{code}</pre>
  );
}

export function ScoreBadge({ label, value }: { label: string; value: number }) {
  return <span className="inline-flex items-center gap-1">{label} <span className="score-badge" style={{ background: scoreColor(value) }}>{value}</span></span>;
}

/** Status shown with an icon and words, never color alone. */
export function FactBadge({ ok }: { ok: boolean }) {
  return ok
    ? <span className="rounded-full border border-pass/30 px-2 py-0.5 text-xs text-pass">✓ Facts kept</span>
    : <span className="rounded-full border border-warn/30 px-2 py-0.5 text-xs text-warn">⚠ Needs review</span>;
}

/** Explains why an AI button is unavailable. Returns null when AI is ready. */
export function AiUnavailable({ access, feature }: { access: AiAccess; feature: string }) {
  if (access === "ready") return null;
  const next = encodeURIComponent("/geo-optimization");
  const msg: Record<Exclude<AiAccess, "ready">, React.ReactNode> = {
    "no-key": <>AI isn&apos;t switched on yet: an admin needs to add ANTHROPIC_API_KEY in Vercel. The free parts of this tool still work.</>,
    "read-only": <>Your account has read-only access, so {feature} isn&apos;t available.</>,
    signin: <>{feature} runs on paid AI, so it needs an account. <Link href={`/sign-in?next=${next}`} className="text-accent hover:underline">Sign in</Link> or <Link href={`/sign-in?mode=signup&next=${next}`} className="text-accent hover:underline">create one with your UW email</Link>.</>,
    pending: <>Your account is waiting for an admin to approve it. {feature} unlocks once they do.</>,
    disabled: <>Your account doesn&apos;t have access. Contact an admin if this is a mistake.</>,
    setup: <>AI features need a database for usage limits. Add DATABASE_URL to switch them on.</>,
  };
  return (
    <p className="flex gap-2 rounded-lg border border-premium/30 bg-premium-soft p-3 text-sm text-muted">
      <Crown size={14} className="mt-0.5 shrink-0 text-premium" />
      <span>{msg[access]}</span>
    </p>
  );
}

/** POSTs to the GEO AI route and returns its result or throws a readable error. */
export async function callGeoAi<T>(kind: "answer-first" | "faq", keyword: string, draft: string): Promise<{ result: T; costMicros: number }> {
  const r = await fetch("/api/ai/geo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, keyword, draft }) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error ?? "The AI request failed.");
  return { result: data.result as T, costMicros: data.costMicros as number };
}

export const EXAMPLE_DRAFT = `# Aurora 12GB Graphics Card

Our Aurora 12GB graphics card is built for gamers who want smooth play at high resolutions, and it comes from a long line of cards that we have designed and tested in our lab over many years, with a lot of care and attention to every detail of the board, the cooler and the fans, so you can trust it in your build for a long time to come.

It has 12 GB of GDDR6X memory and a 2,610 MHz boost clock, so it handles 1440p gaming at high settings. The card is 285 mm long and takes 2.5 slots, so check your case before you buy. It needs a 650 W power supply and connects over PCIe 4.0 x16. Outputs are 3 DisplayPort 1.4a and 1 HDMI 2.1.

It costs $549 and has a 3-year warranty.`;
