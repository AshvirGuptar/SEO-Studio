"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSession } from "@/components/session";
import { Crown } from "@/components/Crown";
import { scoreColor } from "@/components/ScoreRing";
import { formatUsd } from "@/lib/ai/pricing";
import { describeFactCheck } from "@/lib/seo/facts";
import {
  scoreDescription, scoreTitleMeta, TONE_LABEL, TONES,
  type DescriptionResult, type RewriteInput, type ScoredDescription, type ScoredTitleMeta, type TitleMetaResult, type Tone,
} from "@/lib/ai/rewrite";

type Fields = Omit<RewriteInput, "kind" | "tone">;

/**
 * Premium AI rewrite panel. Claude suggests copy; every suggestion is re-scored by our own engine
 * and fact-checked (no invented numbers, prices or claims) before anyone applies it.
 */
export function AiRewrite({ aiEnabled, fields, current, onUseTitleMeta, onUseBody }: {
  aiEnabled: boolean;
  fields: Fields;
  current: { titleScore: number; metaScore: number };
  onUseTitleMeta: (title: string, meta: string) => void;
  onUseBody: (body: string) => void;
}) {
  const { authEnabled, user } = useSession();
  const [tone, setTone] = useState<Tone>("clear");
  const [busy, setBusy] = useState<RewriteInput["kind"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [titleMeta, setTitleMeta] = useState<{ input: RewriteInput; result: TitleMetaResult; cost: number } | null>(null);
  const [desc, setDesc] = useState<{ input: RewriteInput; result: DescriptionResult; cost: number } | null>(null);
  const [undo, setUndo] = useState<{ label: string; run: () => void } | null>(null);

  const scoredTM = useMemo<ScoredTitleMeta[]>(() => (titleMeta ? scoreTitleMeta(titleMeta.input, titleMeta.result) : []), [titleMeta]);
  const scoredDesc = useMemo<ScoredDescription | null>(() => (desc ? scoreDescription(desc.input, desc.result) : null), [desc]);

  // Signed-out visitors (with accounts on) see the Premium prompt; read-only clients don't see AI at all.
  if (authEnabled && !user) {
    return (
      <div className="card flex flex-wrap items-center justify-between gap-3 border-premium/30">
        <div className="text-sm">
          <div className="flex items-center gap-1.5 font-medium text-premium"><Crown size={14} /> AI rewrite</div>
          <div className="text-muted">Suggested titles, metas and descriptions, each scored and fact-checked. Sign in with your UW email to use it.</div>
        </div>
        <Link href="/sign-in?next=/content" className="btn">Sign in</Link>
      </div>
    );
  }
  if (user?.role === "client") return null;

  async function run(kind: RewriteInput["kind"]) {
    setBusy(kind);
    setError(null);
    const input: RewriteInput = { ...fields, kind, tone };
    try {
      const r = await fetch("/api/ai/rewrite", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? "The rewrite failed.");
      if (kind === "title-meta") setTitleMeta({ input, result: data.result, cost: data.costMicros });
      else setDesc({ input, result: data.result, cost: data.costMicros });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The rewrite failed.");
    } finally {
      setBusy(null);
    }
  }

  function applyTitleMeta(v: ScoredTitleMeta) {
    const prev = { title: fields.title, meta: fields.meta };
    onUseTitleMeta(v.title, v.meta);
    setUndo({ label: "title and meta", run: () => onUseTitleMeta(prev.title, prev.meta) });
  }
  function applyBody(text: string) {
    const prev = fields.body;
    onUseBody(text);
    setUndo({ label: "description", run: () => onUseBody(prev) });
  }

  return (
    <div className="card space-y-4 border-premium/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 text-sm">
          <div className="flex items-center gap-1.5 font-medium text-premium"><Crown size={14} /> AI rewrite</div>
          <div className="text-muted">Claude suggests copy from your facts only. Every suggestion is scored by our engine and fact-checked before you use it.</div>
        </div>
        <div>
          <label className="label" htmlFor="ai-tone">Tone</label>
          <select id="ai-tone" className="input" value={tone} onChange={(e) => setTone(e.target.value as Tone)}>
            {TONES.map((t) => <option key={t} value={t}>{TONE_LABEL[t]}</option>)}
          </select>
        </div>
      </div>

      {!aiEnabled ? (
        <p className="rounded-lg border border-border p-3 text-sm text-muted">AI isn&apos;t switched on yet: an admin needs to add ANTHROPIC_API_KEY in Vercel.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button className="btn" disabled={!!busy} onClick={() => run("title-meta")}>{busy === "title-meta" ? "Writing…" : "Suggest titles & metas"}</button>
          <button className="btn-ghost" disabled={!!busy} onClick={() => run("description")}>{busy === "description" ? "Rewriting…" : "Rewrite description"}</button>
        </div>
      )}
      {error && <p className="rounded-lg bg-fail/10 p-2 text-sm text-fail" role="alert">{error}</p>}
      {undo && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted" role="status">
          Applied the new {undo.label}.
          <button className="min-h-8 rounded-lg px-2 text-accent hover:bg-surface-2" onClick={() => { undo.run(); setUndo(null); }}>Undo</button>
        </p>
      )}

      {scoredTM.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between text-xs text-subtle">
            <span>Current: title {current.titleScore} · meta {current.metaScore}</span>
            <span>Cost {formatUsd(titleMeta!.cost, 3)}</span>
          </div>
          {scoredTM.map((v, i) => (
            <div key={i} className="rounded-xl border border-border bg-surface-2/40 p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-subtle">
                <span className="capitalize">{v.angle}</span>
                <Score label="Title" value={v.titleScore} />
                <Score label="Meta" value={v.metaScore} />
                <FactBadge ok={v.facts.ok} />
              </div>
              <p className="mt-2 text-sm font-medium">{v.title} <span className="text-xs font-normal text-subtle">({v.title.length} chars)</span></p>
              <p className="mt-1 text-sm text-muted">{v.meta} <span className="text-xs text-subtle">({v.meta.length} chars)</span></p>
              {!v.facts.ok && <p className="mt-1 text-xs text-warn">{describeFactCheck(v.facts)}</p>}
              <button className="btn-ghost mt-2" onClick={() => applyTitleMeta(v)}>{v.facts.ok ? "Use this" : "Use anyway"}</button>
            </div>
          ))}
        </div>
      )}

      {scoredDesc && (
        <div className="space-y-2 rounded-xl border border-border bg-surface-2/40 p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-subtle">
            <span>SEO {scoredDesc.seoBefore} → <b className="text-foreground">{scoredDesc.seoAfter}</b></span>
            <span>GEO {scoredDesc.geoBefore} → <b className="text-foreground">{scoredDesc.geoAfter}</b></span>
            <FactBadge ok={scoredDesc.facts.ok} />
            <span className="ml-auto">Cost {formatUsd(desc!.cost, 3)}</span>
          </div>
          <p className="whitespace-pre-wrap text-sm text-muted">{scoredDesc.description}</p>
          {scoredDesc.summary && <p className="text-xs text-subtle">What changed: {scoredDesc.summary}</p>}
          {!scoredDesc.facts.ok && <p className="text-xs text-warn">{describeFactCheck(scoredDesc.facts)}</p>}
          <button className="btn-ghost" onClick={() => applyBody(scoredDesc.description)}>{scoredDesc.facts.ok ? "Use this description" : "Use anyway"}</button>
        </div>
      )}
    </div>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return <span className="inline-flex items-center gap-1">{label} <span className="score-badge" style={{ background: scoreColor(value) }}>{value}</span></span>;
}

/** Status shown with an icon and words, never color alone. */
function FactBadge({ ok }: { ok: boolean }) {
  return ok
    ? <span className="rounded-full border border-pass/30 px-2 py-0.5 text-pass">✓ Facts kept</span>
    : <span className="rounded-full border border-warn/30 px-2 py-0.5 text-warn">⚠ Needs review</span>;
}
