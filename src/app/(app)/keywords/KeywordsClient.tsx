"use client";

import { useMemo, useState } from "react";
import { clusterKeywords, mapClustersToPages, parseKeywords, type Intent } from "@/lib/seo/keywords";
import { downloadCsv } from "@/lib/csv";
import { StartOverButton } from "@/components/ResultActions";

// Example data: a fictional PC parts store ("Example PC"). Volumes are illustrative.
const SAMPLE_KEYWORDS = `keyword,volume
graphics card,90500
graphics cards,40500
best graphics card,33100
buy graphics card,1900
graphics card sale,2400
best graphics card for 1440p,6600
1440p graphics card,1900
best graphics card for 4k,4400
low profile graphics card,8100
best low profile graphics card,2900
12gb graphics card,1600
graphics card for video editing,1300
graphics card vs integrated graphics,880
how to install a graphics card,6600
how to choose a graphics card,1600
how much power does a graphics card need,2400
what graphics card do i have,27100
gaming pc power supply,5400`;

const SAMPLE_PAGES = `https://shop.example-pc.com/graphics-cards | Graphics Cards
https://shop.example-pc.com/collections/gpus | Graphics Cards & GPUs
https://shop.example-pc.com/graphics-cards/low-profile | Low Profile Graphics Cards
https://shop.example-pc.com/graphics-cards/1440p | Best Graphics Cards for 1440p Gaming
https://shop.example-pc.com/blog/how-to-install-a-graphics-card | How to Install a Graphics Card`;

export const INTENT_STYLE: Record<Intent, { label: string; cls: string; bar: string }> = {
  transactional: { label: "Transactional", cls: "text-intent-transactional border-intent-transactional/30 bg-intent-transactional/10", bar: "bg-intent-transactional" },
  commercial: { label: "Commercial", cls: "text-intent-commercial border-intent-commercial/30 bg-intent-commercial/10", bar: "bg-intent-commercial" },
  informational: { label: "Informational", cls: "text-intent-informational border-intent-informational/30 bg-intent-informational/10", bar: "bg-intent-informational" },
  navigational: { label: "Navigational", cls: "text-intent-navigational border-intent-navigational/30 bg-intent-navigational/10", bar: "bg-intent-navigational" },
};

const PAGE_TYPE: Record<Intent, string> = {
  transactional: "Product / category page",
  commercial: "Category or comparison page",
  informational: "Blog post / guide",
  navigational: "Brand / account page",
};

const fmt = (n: number) => n.toLocaleString("en-US");

export function KeywordsClient() {
  const [kwText, setKwText] = useState(SAMPLE_KEYWORDS);
  const [pagesText, setPagesText] = useState(SAMPLE_PAGES);
  const [strictness, setStrictness] = useState(70);
  const [open, setOpen] = useState<Set<number>>(new Set([0]));

  const keywords = useMemo(() => parseKeywords(kwText).slice(0, 3000), [kwText]);
  const result = useMemo(
    () => mapClustersToPages(clusterKeywords(keywords, strictness / 100), pagesText),
    [keywords, strictness, pagesText],
  );
  const { clusters, cannibalized, competing, gaps } = result;
  const conflicts = cannibalized.length + competing.length;
  const hasPages = pagesText.trim().length > 0;
  const hasVolume = keywords.some((k) => k.volume !== undefined);

  const intentTotals = useMemo(() => {
    const t: Record<Intent, number> = { transactional: 0, commercial: 0, informational: 0, navigational: 0 };
    for (const c of clusters) for (const k of c.keywords) t[k.intent] += hasVolume ? k.volume ?? 0 : 1;
    return t;
  }, [clusters, hasVolume]);
  const intentSum = Object.values(intentTotals).reduce((a, b) => a + b, 0) || 1;

  function toggle(id: number) {
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function exportCsv() {
    downloadCsv("keyword-clusters.csv", [
      ["cluster", "cluster_intent", "keyword", "keyword_intent", "volume", "mapped_page", "suggested_slug"],
      ...clusters.flatMap((c) =>
        c.keywords.map((k) => [c.name, c.intent, k.keyword, k.intent, k.volume ?? "", c.page ?? "", c.page ? "" : `/${c.suggestedSlug}`]),
      ),
    ]);
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <label className="label" htmlFor="kws">Keywords: one per line, optional “,volume”</label>
          <textarea id="kws" className="input h-56 font-mono text-xs" value={kwText} onChange={(e) => setKwText(e.target.value)} />
          <p className="mt-2 text-xs text-subtle">
            Tip: export queries from Google Search Console or Keyword Planner and paste the CSV here. Up to 3,000 keywords.
          </p>
        </div>
        <div className="card">
          <label className="label" htmlFor="pages">Your existing pages (optional): “URL | Page title” per line</label>
          <textarea id="pages" className="input h-56 font-mono text-xs" value={pagesText} onChange={(e) => setPagesText(e.target.value)} />
          <p className="mt-2 text-xs text-subtle">Used to map clusters to pages, find content gaps and detect keyword cannibalization.</p>
        </div>
      </div>

      <div className="card flex flex-wrap items-center gap-x-8 gap-y-4">
        <div className="min-w-56 flex-1">
          <label className="label" htmlFor="strict">Grouping: {strictness < 50 ? "Loose" : strictness > 80 ? "Strict" : "Balanced"}</label>
          <div className="flex items-center gap-3 text-xs text-subtle">
            Broad topics
            <input id="strict" type="range" min={20} max={95} value={strictness} onChange={(e) => setStrictness(Number(e.target.value))} className="h-8 flex-1 accent-[var(--accent)]" />
            Tight topics
          </div>
        </div>
        <Stat label="Keywords" value={fmt(keywords.length)} />
        <Stat label="Clusters" value={fmt(clusters.length)} />
        {hasPages && <Stat label="Content gaps" value={fmt(gaps.length)} tone={gaps.length ? "warn" : undefined} />}
        {hasPages && <Stat label="Cannibalization" value={fmt(conflicts)} tone={conflicts ? "fail" : undefined} />}
        <button className="btn-ghost" onClick={exportCsv} disabled={!clusters.length}>Export CSV</button>
        {kwText || pagesText ? (
          <StartOverButton label="Clear" onClick={() => { setKwText(""); setPagesText(""); setStrictness(70); setOpen(new Set([0])); }} />
        ) : (
          <button className="btn-ghost" onClick={() => { setKwText(SAMPLE_KEYWORDS); setPagesText(SAMPLE_PAGES); }}>Load example</button>
        )}
      </div>

      {clusters.length > 0 && (
        <div className="card">
          <h2 className="label">Search intent mix {hasVolume ? "(by volume)" : "(by keyword count)"}</h2>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-2">
            {(Object.keys(intentTotals) as Intent[]).map((i) =>
              intentTotals[i] ? <div key={i} className={INTENT_STYLE[i].bar} style={{ width: `${(intentTotals[i] / intentSum) * 100}%` }} /> : null,
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
            {(Object.keys(intentTotals) as Intent[]).map((i) => (
              <span key={i} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${INTENT_STYLE[i].bar}`} />
                {INTENT_STYLE[i].label} {Math.round((intentTotals[i] / intentSum) * 100)}%
              </span>
            ))}
          </div>
        </div>
      )}

      {conflicts > 0 && (
        <div className="card border-fail/30">
          <h2 className="font-medium text-fail">Possible keyword cannibalization</h2>
          <p className="mt-1 text-sm text-muted">
            When pages compete for the same searches, Google splits signals between them and often ranks neither well.
          </p>
          {competing.length > 0 && (
            <div className="mt-4">
              <h3 className="label">Several pages target the same cluster</h3>
              <p className="mb-2 text-sm text-muted">Pick one page to own the topic. Merge the others into it and 301-redirect them, or re-focus them on a different cluster.</p>
              <ul className="space-y-2 text-sm">
                {competing.map((c) => (
                  <li key={c.cluster}><b>{c.cluster}</b> <span className="text-subtle">←</span> {c.pages.map((p) => <span key={p} className="mr-2 break-all font-mono text-xs">{p}</span>)}</li>
                ))}
              </ul>
            </div>
          )}
          {cannibalized.length > 0 && (
            <div className="mt-4">
              <h3 className="label">One page is the best match for several clusters</h3>
              <p className="mb-2 text-sm text-muted">Give each cluster its own focused page, or make sure this page is clearly about one of them.</p>
              <ul className="space-y-2 text-sm">
                {cannibalized.map((c) => (
                  <li key={c.page}><span className="break-all font-mono text-xs">{c.page}</span> <span className="text-subtle">←</span> {c.clusters.join(" · ")}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        {clusters.map((c) => {
          const isOpen = open.has(c.id);
          return (
            <div key={c.id} className="card p-0">
              <button onClick={() => toggle(c.id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 p-4 text-left">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{c.name}</span>
                  <span className="ml-2 text-xs text-subtle">{c.keywords.length} keyword{c.keywords.length === 1 ? "" : "s"}</span>
                </span>
                <span className={`rounded-full border px-2 py-0.5 text-xs ${INTENT_STYLE[c.intent].cls}`}>{INTENT_STYLE[c.intent].label}</span>
                {hasVolume && <span className="w-24 text-right text-sm tabular-nums">{fmt(c.totalVolume)}<span className="text-xs text-subtle">/mo</span></span>}
                <span className="text-subtle">{isOpen ? "▴" : "▾"}</span>
              </button>
              {isOpen && (
                <div className="grid gap-4 border-t border-border p-4 md:grid-cols-[1fr_280px]">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-border">
                      {c.keywords.map((k) => (
                        <tr key={k.keyword}>
                          <td className="py-1.5">{k.keyword}</td>
                          <td className="py-1.5 text-right text-xs text-subtle">{INTENT_STYLE[k.intent].label}</td>
                          {hasVolume && <td className="w-20 py-1.5 text-right tabular-nums text-muted">{k.volume !== undefined ? fmt(k.volume) : "—"}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="space-y-3 rounded-xl bg-surface-2/60 p-3 text-sm">
                    <div>
                      <div className="label mb-0.5">Recommended page type</div>
                      {PAGE_TYPE[c.intent]}
                    </div>
                    <div>
                      <div className="label mb-0.5">Target page</div>
                      {c.page ? (
                        <span className="break-all font-mono text-xs text-pass">{c.page}</span>
                      ) : (
                        <span className="text-sm">
                          {hasPages && <span className="text-warn">No matching page. </span>}
                          Suggested: <span className="font-mono text-xs text-accent">/{c.suggestedSlug}</span>
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="label mb-0.5">Use as</div>
                      <span className="text-muted">Primary keyword <b className="text-foreground">{c.name}</b> in the title, H1 and URL; work the others into headings and copy.</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" | "fail" }) {
  return (
    <div>
      <div className="label mb-0">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${tone === "warn" ? "text-warn" : tone === "fail" ? "text-fail" : ""}`}>{value}</div>
    </div>
  );
}
