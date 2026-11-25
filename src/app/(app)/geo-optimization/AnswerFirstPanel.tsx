"use client";

import { useMemo, useState } from "react";
import { CheckList } from "@/components/CheckList";
import { ScoreRing } from "@/components/ScoreRing";
import { Crown } from "@/components/Crown";
import { formatUsd } from "@/lib/ai/pricing";
import { describeFactCheck } from "@/lib/seo/facts";
import { analyzeDraftGeo, diffDrafts, diffWords, type DiffRow } from "@/lib/seo/geo-optimize";
import { summarize } from "@/lib/seo/score";
import { scoreAnswerFirst, type AnswerFirstResult, type GeoAiInput } from "@/lib/ai/geo-optimize";
import { AiUnavailable, callGeoAi, CopyButton, EXAMPLE_DRAFT, FactBadge, ScoreBadge, type AiAccess } from "./ui";

/**
 * Answer-first rewrite: live GEO score of the draft, then Claude restructures it (summary lead,
 * question headings, short direct answers). The result is re-scored and fact-checked, and shown as a
 * side-by-side diff to accept or reject.
 */
export function AnswerFirstPanel({ ai, keyword, setKeyword, draft, setDraft }: {
  ai: AiAccess;
  keyword: string;
  setKeyword: (v: string) => void;
  draft: string;
  setDraft: (v: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<{ input: GeoAiInput; result: AnswerFirstResult; cost: number } | null>(null);
  const [undo, setUndo] = useState<string | null>(null);

  const checks = useMemo(() => analyzeDraftGeo(draft), [draft]);
  const score = summarize(checks);
  const scored = useMemo(() => (run ? scoreAnswerFirst(run.input, run.result) : null), [run]);
  const rows = useMemo(() => (run ? diffDrafts(run.input.draft, run.result.markdown) : []), [run]);
  const wordCount = draft.split(/\s+/).filter(Boolean).length;

  async function rewrite() {
    setBusy(true);
    setError(null);
    const input: GeoAiInput = { kind: "answer-first", keyword: keyword.trim(), draft };
    try {
      const { result, costMicros } = await callGeoAi<AnswerFirstResult>("answer-first", input.keyword, draft);
      setRun({ input, result, cost: costMicros });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The rewrite failed.");
    } finally {
      setBusy(false);
    }
  }

  function accept() {
    if (!run) return;
    setUndo(draft);
    setDraft(run.result.markdown);
    setRun(null);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="min-w-0 space-y-4">
        <div className="card space-y-4">
          <div>
            <label className="label" htmlFor="geo-kw">Target keyword or question (optional)</label>
            <input id="geo-kw" className="input" placeholder="1440p graphics card" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          </div>
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <label className="label" htmlFor="geo-draft">Page copy</label>
              <span className="text-xs text-subtle">
                {wordCount} words ·{" "}
                {!draft && <button type="button" className="min-h-8 rounded-lg px-1 text-accent hover:bg-surface-2" onClick={() => setDraft(EXAMPLE_DRAFT)}>Try an example</button>}
              </span>
            </div>
            <textarea id="geo-draft" className="input h-72 font-mono text-xs leading-relaxed" value={draft} onChange={(e) => setDraft(e.target.value)}
              placeholder={"Paste the page's text. Simple Markdown works best:\n# Page title\n\nOpening paragraph…\n\n## A question people ask?\n\nA short, direct answer…\n\n- list items\n| Spec | Value |"} />
            <p className="mt-1 text-xs text-subtle">Use <code>#</code> for headings, blank lines between paragraphs, <code>-</code> for lists. A short line ending in “?” counts as a question heading.</p>
          </div>
        </div>

        <div className="card space-y-3 border-premium/30">
          <div className="text-sm">
            <div className="flex items-center gap-1.5 font-medium text-premium"><Crown size={14} /> Answer-first rewrite</div>
            <div className="text-muted">Claude adds a summary lead, question headings and short direct answers, using only your facts. We re-score it and check every number before you accept.</div>
          </div>
          <AiUnavailable access={ai} feature="The answer-first rewrite" />
          {ai === "ready" && (
            <button className="btn" disabled={busy || wordCount < 40} onClick={rewrite}>
              {busy ? "Rewriting…" : wordCount < 40 ? "Paste at least 40 words" : "Rewrite answer-first"}
            </button>
          )}
          {error && <p className="rounded-lg bg-fail/10 p-2 text-sm text-fail" role="alert">{error}</p>}
          {undo !== null && (
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted" role="status">
              Accepted the rewrite.
              <button className="min-h-8 rounded-lg px-2 text-accent hover:bg-surface-2" onClick={() => { setDraft(undo); setUndo(null); }}>Undo</button>
            </p>
          )}
        </div>

        {scored && run && (
          <div className="card space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <h2 className="mr-auto font-medium">Review the rewrite</h2>
              <ScoreBadge label="GEO before" value={scored.geoBefore} />
              <span aria-hidden="true" className="text-subtle">→</span>
              <ScoreBadge label="after" value={scored.geoAfter} />
              <FactBadge ok={scored.facts.ok} />
              <span className="text-xs text-subtle">Cost {formatUsd(run.cost, 3)}</span>
            </div>
            {scored.summary && <p className="text-sm text-muted">What changed: {scored.summary}</p>}
            {!scored.facts.ok && <p className="rounded-lg bg-warn/10 p-2 text-sm text-warn">{describeFactCheck(scored.facts)} Check these before you accept.</p>}
            <SideBySide rows={rows} />
            <div className="flex flex-wrap gap-2">
              <button className="btn" onClick={accept}>{scored.facts.ok ? "Accept rewrite" : "Accept anyway"}</button>
              <button className="btn-ghost" onClick={() => setRun(null)}>Reject</button>
              <CopyButton text={scored.markdown} label="Copy rewrite" />
            </div>
          </div>
        )}
      </div>

      <aside className="min-w-0 space-y-4">
        <div className="card">
          {draft.trim() ? (
            <ScoreRing summary={score} label="GEO score (copy)" />
          ) : (
            <p className="text-sm text-muted">Paste page copy to see its GEO score: how easy it is for AI answers to quote.</p>
          )}
        </div>
        {checks.length > 0 && <div className="card"><CheckList checks={checks} /></div>}
        <p className="px-1 text-xs text-subtle">Scored with the Page Analyzer&apos;s answer-ready checks. Crawler access, schema and trust signals live outside the copy: use the Schema and AI access kit tabs.</p>
      </aside>
    </div>
  );
}

/** Before/after blocks next to each other (stacked on phones), with changed words highlighted. */
function SideBySide({ rows }: { rows: DiffRow[] }) {
  const changed = rows.filter((r) => r.kind !== "same").length;
  return (
    <div className="space-y-2">
      <div className="hidden grid-cols-2 gap-3 text-xs font-medium uppercase tracking-wide text-subtle md:grid">
        <span>Before</span><span>After</span>
      </div>
      <p className="text-xs text-subtle">{changed} of {rows.length} blocks changed. <span className="rounded bg-fail/15 px-1 text-fail line-through">Removed</span> <span className="rounded bg-pass/15 px-1 text-pass">added</span></p>
      <div className="space-y-2">
        {rows.map((r, i) => {
          const words = r.kind === "changed" ? diffWords(r.before, r.after) : null;
          return (
            <div key={i} className="grid gap-2 md:grid-cols-2 md:gap-3">
              <Cell side="Before" kind={r.kind}>
                {r.kind === "added" ? null : words
                  ? words.filter((w) => w.op !== "+").map((w, j) => <span key={j} className={w.op === "-" ? "rounded bg-fail/15 text-fail line-through" : ""}>{w.text}</span>)
                  : r.before}
              </Cell>
              <Cell side="After" kind={r.kind}>
                {r.kind === "removed" ? null : words
                  ? words.filter((w) => w.op !== "-").map((w, j) => <span key={j} className={w.op === "+" ? "rounded bg-pass/15 text-pass" : ""}>{w.text}</span>)
                  : r.after}
              </Cell>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Cell({ side, kind, children }: { side: "Before" | "After"; kind: DiffRow["kind"]; children: React.ReactNode }) {
  const empty = children === null;
  const tone = kind === "same" ? "border-border text-subtle" : side === "Before" ? "border-fail/25" : "border-pass/25";
  return (
    <div className={`min-w-0 rounded-xl border p-3 text-sm ${empty ? "hidden border-dashed border-border md:block" : tone}`}>
      <div className="mb-1 text-[11px] uppercase tracking-wide text-subtle md:hidden">{side}</div>
      <div className="whitespace-pre-wrap break-words">{empty ? <span className="text-xs text-subtle">{side === "Before" ? "New" : "Removed"}</span> : children}</div>
    </div>
  );
}
