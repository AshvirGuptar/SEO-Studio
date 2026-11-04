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
import { analyzeCopyGeo, analyzeSpecs, parseSpecs } from "@/lib/seo/specs";

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
  const [specs, setSpecs] = useState("");
  const [tab, setTab] = useState<"seo" | "geo">("seo");

  const kw = keyword.trim() || undefined;
  const hasInput = Boolean(keyword || title || meta || url || body || specs);
  function startOver() {
    setKeyword(""); setTitle(""); setMeta(""); setUrl(""); setBody(""); setSpecs(""); setPreset("product"); setTab("seo");
  }
  const sections = useMemo(() => {
    const t = analyzeTitle(title, kw);
    const m = analyzeMetaDescription(meta, kw);
    const b = analyzeBodyCopy(body, kw, { minWords: PRESETS[preset].minWords });
    const u = url.trim() ? analyzeUrl(url, kw) : [];
    const sp = analyzeSpecs(specs, { keyword: kw, preset });
    return { title: t, meta: m, body: b, url: u, specs: sp };
  }, [title, meta, body, url, specs, kw, preset]);

  const all = [...sections.title, ...sections.meta, ...sections.body, ...sections.url, ...sections.specs];
  const overall = summarize(all);
  const geoChecks = useMemo(() => analyzeCopyGeo(body, specs), [body, specs]);
  const geo = summarize(geoChecks);
  const parsedSpecs = useMemo(() => parseSpecs(specs), [specs]);
  const issueCount = (c: { severity: string }[]) => c.filter((x) => x.severity === "fail" || x.severity === "warn").length;
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
            <input id="kw" className="input" placeholder="ar15 charging handle" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
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
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="AR-15 Charging Handle – Mil-Spec 7075 Aluminum | Brand" />
        </Field>

        <Field label="Meta description" score={summarize(sections.meta).score} hint={`${meta.length}/${LIMITS.metaMaxChars} chars`}>
          <textarea className="input h-20" value={meta} onChange={(e) => setMeta(e.target.value)}
            placeholder="Shop a mil-spec AR-15 charging handle machined from 7075-T6 aluminum. Drop-in fit, lifetime warranty and fast shipping." />
        </Field>

        <Field label="URL" score={url ? summarize(sections.url).score : undefined}
          hint={kw || title ? <button type="button" className="text-accent hover:underline" onClick={() => setUrl(`/${slugify(title || keyword)}`)}>Generate from {title ? "title" : "keyword"}</button> : undefined}>
          <input className="input font-mono text-sm" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/ar15-charging-handle" />
        </Field>

        <Field label="Body / product description" score={summarize(sections.body).score}
          hint={`${body.split(/\s+/).filter(Boolean).length} words`}>
          <textarea className="input h-64" value={body} onChange={(e) => setBody(e.target.value)}
            placeholder="Describe the part: what it is, compatibility, materials and finish, latch style, who it's for…" />
        </Field>

        <Field label="Specs (optional)" score={specs.trim() ? summarize(sections.specs).score : undefined}
          hint={parsedSpecs.specs.length ? `${parsedSpecs.specs.length} attributes` : "e.g. the “Specs” or “Details” tab"}>
          <textarea className="input h-40 font-mono text-xs" value={specs} onChange={(e) => setSpecs(e.target.value)}
            placeholder={"One per line, “Label: Value”\nMaterial: 7075-T6 aluminum\nFinish: Type III hard-coat anodized, black\nCompatibility: Mil-spec AR-15 / M4 upper receivers\nLatch: Ambidextrous, extended\nWeight: 1.4 oz\nWarranty: Lifetime"} />
          {parsedSpecs.specs.length > 0 && (
            <details className="mt-3 text-sm" open>
              <summary className="cursor-pointer text-xs text-subtle">Preview as a spec table</summary>
              <table className="mt-2 w-full overflow-hidden rounded-xl border border-border text-sm">
                <tbody className="divide-y divide-border">
                  {parsedSpecs.specs.map((sp, i) => (
                    <tr key={i}>
                      <th scope="row" className="w-2/5 bg-surface-2/50 px-3 py-1.5 text-left font-medium">{sp.label}</th>
                      <td className="px-3 py-1.5 text-muted">{sp.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedSpecs.unstructured.length > 0 && (
                <p className="mt-2 text-xs text-warn">
                  {parsedSpecs.unstructured.length} line(s) aren&apos;t “Label: Value”: {parsedSpecs.unstructured.slice(0, 3).map((l) => `“${l.slice(0, 40)}”`).join(", ")}
                </p>
              )}
            </details>
          )}
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
        <div className="card grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <ScoreRing summary={overall} label="SEO score · search engines" size={96} />
          <ScoreRing summary={geo} label="GEO score · AI answer engines" size={96} />
        </div>
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
        <div className="card">
          <div className="mb-3 flex flex-wrap gap-2">
            <button className={`pill ${tab === "seo" ? "pill-on" : "pill-off"}`} onClick={() => setTab("seo")}>SEO · {issueCount(all)}</button>
            <button className={`pill ${tab === "geo" ? "pill-on" : "pill-off"}`} onClick={() => setTab("geo")}>GEO / AI · {issueCount(geoChecks)}</button>
          </div>
          <CheckList key={tab} checks={tab === "seo" ? all : geoChecks} groupByCategory={false} />
        </div>
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
