"use client";

import { useMemo, useState } from "react";
import { CheckList } from "@/components/CheckList";
import { Crown } from "@/components/Crown";
import { formatUsd } from "@/lib/ai/pricing";
import { describeFactCheck } from "@/lib/seo/facts";
import { extractFaqs, type FaqItem } from "@/lib/seo/geo-optimize";
import { buildFaqPage, jsonLdScript, validateJsonLd } from "@/lib/seo/schema";
import { summarize } from "@/lib/seo/score";
import { scoreFaqs, type FaqResult, type ScoredFaq } from "@/lib/ai/geo-optimize";
import { AiUnavailable, callGeoAi, CodeBlock, CopyButton, DownloadButton, FactBadge, ScoreBadge, type AiAccess } from "./ui";

/**
 * FAQ generator: Q&A already on the page (free) plus Claude suggestions from the page's own content
 * (fact-checked), collected into an editable list that becomes FAQPage JSON-LD and an on-page section.
 */
export function FaqPanel({ ai, keyword, draft, setDraft }: { ai: AiAccess; keyword: string; draft: string; setDraft: (v: string) => void }) {
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<{ items: ScoredFaq[]; cost: number } | null>(null);
  const [addedToCopy, setAddedToCopy] = useState(false);

  const found = useMemo(() => extractFaqs(draft), [draft]);
  const has = (q: string) => faqs.some((f) => f.question.trim().toLowerCase() === q.trim().toLowerCase());
  const add = (f: FaqItem) => { if (!has(f.question)) setFaqs((list) => [...list, { question: f.question, answer: f.answer }]); };
  const update = (i: number, patch: Partial<FaqItem>) => setFaqs((list) => list.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const remove = (i: number) => setFaqs((list) => list.filter((_, j) => j !== i));

  const data = useMemo(() => buildFaqPage(faqs), [faqs]);
  const checks = useMemo(() => validateJsonLd(data), [data]);
  const fails = checks.filter((c) => c.severity === "fail").length;
  const script = jsonLdScript(data);
  const complete = faqs.filter((f) => f.question.trim() && f.answer.trim());
  const wordCount = draft.split(/\s+/).filter(Boolean).length;

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const { result, costMicros } = await callGeoAi<FaqResult>("faq", keyword.trim(), draft);
      setSuggested({ items: scoreFaqs({ kind: "faq", keyword: keyword.trim(), draft }, result), cost: costMicros });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generating FAQs failed.");
    } finally {
      setBusy(false);
    }
  }

  function addSectionToCopy() {
    const section = ["## Frequently asked questions", ...complete.map((f) => `### ${f.question.trim()}\n\n${f.answer.trim()}`)].join("\n\n");
    setDraft(`${draft.trimEnd()}\n\n${section}\n`);
    setAddedToCopy(true);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="min-w-0 space-y-4">
        <div className="card space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <label className="label mb-0" htmlFor="faq-draft">Page copy</label>
            <span className="text-xs text-subtle">{wordCount} words · shared with the Answer-first tab</span>
          </div>
          <textarea id="faq-draft" className="input h-40 font-mono text-xs" value={draft} onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste the page's text. Questions and answers are drawn only from it." />
        </div>

        <div className="card space-y-3">
          <h2 className="font-medium">Already on your page</h2>
          {found.length === 0 ? (
            <p className="text-sm text-muted">No question headings with answers found yet. Headings like “How should it fit?” followed by an answer show up here.</p>
          ) : (
            <ul className="space-y-2">
              {found.map((f, i) => (
                <li key={i} className="flex flex-wrap items-start gap-2 rounded-xl border border-border bg-surface-2/40 p-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{f.question}</div>
                    <div className="line-clamp-2 text-muted">{f.answer}</div>
                  </div>
                  <button className="btn-ghost" disabled={has(f.question)} onClick={() => add(f)}>{has(f.question) ? "Added" : "Add"}</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card space-y-3 border-premium/30">
          <div className="text-sm">
            <div className="flex items-center gap-1.5 font-medium text-premium"><Crown size={14} /> Generate FAQs</div>
            <div className="text-muted">Claude writes questions people ask, answered only from your page. Each one is fact-checked.</div>
          </div>
          <AiUnavailable access={ai} feature="The FAQ generator" />
          {ai === "ready" && (
            <button className="btn" disabled={busy || wordCount < 40} onClick={generate}>
              {busy ? "Writing…" : wordCount < 40 ? "Paste at least 40 words" : "Generate FAQs"}
            </button>
          )}
          {error && <p className="rounded-lg bg-fail/10 p-2 text-sm text-fail" role="alert">{error}</p>}
          {suggested && (
            <div className="space-y-2">
              <p className="text-right text-xs text-subtle">Cost {formatUsd(suggested.cost, 3)}</p>
              {suggested.items.map((f, i) => (
                <div key={i} className="rounded-xl border border-border bg-surface-2/40 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <FactBadge ok={f.facts.ok} />
                    <span className={`text-xs ${f.directAnswer ? "text-subtle" : "text-warn"}`}>{f.words} words{f.directAnswer ? "" : " (aim for 25–90)"}</span>
                  </div>
                  <div className="mt-2 font-medium">{f.question}</div>
                  <p className="mt-1 text-muted">{f.answer}</p>
                  {!f.facts.ok && <p className="mt-1 text-xs text-warn">{describeFactCheck(f.facts)}</p>}
                  <button className="btn-ghost mt-2" disabled={has(f.question)} onClick={() => add(f)}>
                    {has(f.question) ? "Added" : f.facts.ok ? "Add" : "Add anyway"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium">Your FAQ ({complete.length})</h2>
            <button className="btn-ghost" onClick={() => setFaqs((l) => [...l, { question: "", answer: "" }])}>Add a question</button>
          </div>
          {faqs.length === 0 && <p className="text-sm text-muted">Add questions from your page or the AI suggestions, or write your own.</p>}
          {faqs.map((f, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-border p-3">
              <label className="sr-only" htmlFor={`faq-q-${i}`}>Question {i + 1}</label>
              <input id={`faq-q-${i}`} className="input" placeholder="Question?" value={f.question} onChange={(e) => update(i, { question: e.target.value })} />
              <label className="sr-only" htmlFor={`faq-a-${i}`}>Answer {i + 1}</label>
              <textarea id={`faq-a-${i}`} className="input h-20" placeholder="Short, direct answer" value={f.answer} onChange={(e) => update(i, { answer: e.target.value })} />
              <button className="min-h-8 rounded-lg px-2 text-sm text-muted hover:bg-surface-2 hover:text-foreground" onClick={() => remove(i)}>Remove</button>
            </div>
          ))}
          {complete.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn-ghost" onClick={addSectionToCopy}>Add as an FAQ section to the page copy</button>
              {addedToCopy && <span className="text-xs text-subtle" role="status">Added; the GEO score on the Answer-first tab updates.</span>}
            </div>
          )}
        </div>
      </div>

      <aside className="min-w-0 space-y-4">
        <div className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium">FAQPage JSON-LD</h2>
            <ScoreBadge label="Valid" value={summarize(checks).score} />
          </div>
          <CodeBlock code={script} label="FAQPage JSON-LD" />
          <div className="flex flex-wrap gap-2">
            <CopyButton text={script} label={fails ? "Copy anyway" : "Copy markup"} className={fails ? "btn-ghost" : "btn"} />
            <DownloadButton text={JSON.stringify(data, null, 2)} filename="faq-schema.json" type="application/ld+json" label="Download .json" />
          </div>
          <p className="text-xs text-subtle">Paste it into the page&apos;s &lt;head&gt; or before &lt;/body&gt;. The same Q&amp;A must be visible on the page.</p>
        </div>
        <div className="card"><CheckList checks={checks} groupByCategory={false} /></div>
      </aside>
    </div>
  );
}
