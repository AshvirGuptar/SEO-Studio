"use client";

import { useMemo, useState } from "react";
import { analyzeBodyCopy, analyzeMetaDescription, analyzeTitle, LIMITS } from "@/lib/seo/copy";
import { analyzeUrl, slugify } from "@/lib/seo/slug";
import { summarize } from "@/lib/seo/score";
import { approxPixelWidth, topTerms } from "@/lib/seo/text";
import { CheckList } from "@/components/CheckList";
import { ScoreRing, scoreColor } from "@/components/ScoreRing";
import { SerpPreview } from "@/components/SerpPreview";
import { StartOverButton } from "@/components/ResultActions";

const PRESETS = {
  product: { label: "Product page", minWords: 150 },
  category: { label: "Category page", minWords: 250 },
  blog: { label: "Blog / article", minWords: 800 },
} as const;
type Preset = keyof typeof PRESETS;

export function ContentClient() {
  const [preset, setPreset] = useState<Preset>("product");
  const [keyword, setKeyword] = useState("");
  const [title, setTitle] = useState("");
  const [meta, setMeta] = useState("");
  const [url, setUrl] = useState("");
  const [body, setBody] = useState("");

  const kw = keyword.trim() || undefined;
  const hasInput = Boolean(keyword || title || meta || url || body);
  function startOver() {
    setKeyword(""); setTitle(""); setMeta(""); setUrl(""); setBody(""); setPreset("product");
  }
  const sections = useMemo(() => {
    const t = analyzeTitle(title, kw);
    const m = analyzeMetaDescription(meta, kw);
    const b = analyzeBodyCopy(body, kw, { minWords: PRESETS[preset].minWords });
    const u = url.trim() ? analyzeUrl(url, kw) : [];
    return { title: t, meta: m, body: b, url: u };
  }, [title, meta, body, url, kw, preset]);

  const all = [...sections.title, ...sections.meta, ...sections.body, ...sections.url];
  const overall = summarize(all);
  const terms = useMemo(() => topTerms(body, 8), [body]);

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        {hasInput && (
          <div className="flex justify-end"><StartOverButton onClick={startOver} /></div>
        )}
        <div className="card grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="kw">Target keyword</label>
            <input id="kw" className="input" placeholder="waterproof hiking boots" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="preset">Content type</label>
            <select id="preset" className="input" value={preset} onChange={(e) => setPreset(e.target.value as Preset)}>
              {Object.entries(PRESETS).map(([k, p]) => <option key={k} value={k}>{p.label} (≥{p.minWords} words)</option>)}
            </select>
          </div>
        </div>

        <Field label="Page title" score={summarize(sections.title).score}
          hint={`${title.length}/${LIMITS.titleMaxChars} chars · ~${approxPixelWidth(title)}/${LIMITS.titleMaxPx}px`}>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Waterproof Hiking Boots for Men & Women | Brand" />
        </Field>

        <Field label="Meta description" score={summarize(sections.meta).score} hint={`${meta.length}/${LIMITS.metaMaxChars} chars`}>
          <textarea className="input h-20" value={meta} onChange={(e) => setMeta(e.target.value)}
            placeholder="Shop waterproof hiking boots built for wet trails. Free shipping and 60-day returns." />
        </Field>

        <Field label="URL" score={url ? summarize(sections.url).score : undefined}
          hint={kw || title ? <button type="button" className="text-accent hover:underline" onClick={() => setUrl(`/${slugify(title || keyword)}`)}>Generate from {title ? "title" : "keyword"}</button> : undefined}>
          <input className="input font-mono text-sm" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/hiking-boots/waterproof" />
        </Field>

        <Field label="Body / product description" score={summarize(sections.body).score}
          hint={`${body.split(/\s+/).filter(Boolean).length} words`}>
          <textarea className="input h-64" value={body} onChange={(e) => setBody(e.target.value)}
            placeholder="Describe the product: who it's for, key features, materials, sizing, care…" />
        </Field>

        <div className="card flex flex-wrap items-center justify-between gap-3 border-dashed">
          <div className="text-sm">
            <div className="font-medium">AI rewrite</div>
            <div className="text-muted">Generate optimized titles, metas and descriptions. Enabled once an AI API key is configured.</div>
          </div>
          <button className="btn" disabled title="Coming soon — needs an AI API key">Rewrite with AI</button>
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div className="card"><ScoreRing summary={overall} label="Overall content score" /></div>
        <div className="card">
          <h2 className="label">Search result preview</h2>
          <SerpPreview title={title} description={meta} url={url.startsWith("http") ? url : `example.com${url.startsWith("/") ? "" : "/"}${url}`} />
        </div>
        {terms.length > 0 && (
          <div className="card text-sm">
            <h2 className="label">Most-used terms in body</h2>
            <div className="flex flex-wrap gap-1.5">
              {terms.map((t) => <span key={t.term} className="chip">{t.term} · {t.count}</span>)}
            </div>
          </div>
        )}
        <div className="card"><CheckList checks={all} groupByCategory={false} /></div>
      </aside>
    </div>
  );
}

function Field({ label, score, hint, children }: { label: string; score?: number; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="label mb-0">{label}</span>
        <div className="flex items-center gap-3 text-xs text-muted">
          {hint}
          {score !== undefined && (
            <span className="score-badge" style={{ background: scoreColor(score) }}>{score}</span>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
