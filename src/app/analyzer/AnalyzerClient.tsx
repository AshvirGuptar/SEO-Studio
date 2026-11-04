"use client";

import { useState } from "react";
import type { PageReport } from "@/lib/seo/analyze-page";
import { CheckList } from "@/components/CheckList";
import { ScoreRing } from "@/components/ScoreRing";
import { SerpPreview } from "@/components/SerpPreview";

type Mode = "url" | "html";
type Report = PageReport & { fetch?: { status: number; redirects: string[]; elapsedMs: number } };

export function AnalyzerClient() {
  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState("");
  const [html, setHtml] = useState("");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const body = mode === "url" ? { url, keyword: keyword || undefined } : { html, url: url || undefined, keyword: keyword || undefined };
      const res = await fetch("/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed.");
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 space-y-6">
      <form onSubmit={run} className="card space-y-4">
        <div className="flex gap-2">
          {(["url", "html"] as const).map((m) => (
            <button type="button" key={m} onClick={() => setMode(m)}
              className={`pill ${mode === m ? "pill-on" : "pill-off"}`}>
              {m === "url" ? "Live URL" : "Paste HTML"}
            </button>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-[1fr_260px]">
          <div>
            <label className="label" htmlFor="url">{mode === "url" ? "Page URL" : "Page URL (optional, for link/URL checks)"}</label>
            <input id="url" className="input" placeholder="https://example.com/products/running-shoes" value={url}
              onChange={(e) => setUrl(e.target.value)} required={mode === "url"} />
          </div>
          <div>
            <label className="label" htmlFor="kw">Target keyword (optional)</label>
            <input id="kw" className="input" placeholder="running shoes" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          </div>
        </div>
        {mode === "html" && (
          <div>
            <label className="label" htmlFor="html">HTML source</label>
            <textarea id="html" className="input h-48 font-mono text-xs" placeholder="<!doctype html>…" value={html}
              onChange={(e) => setHtml(e.target.value)} required />
          </div>
        )}
        <button className="btn" disabled={loading}>{loading ? "Analyzing…" : "Analyze page"}</button>
        {error && <p className="text-sm text-fail">{error}</p>}
      </form>

      {report && <ReportView report={report} />}
    </div>
  );
}

function ReportView({ report }: { report: Report }) {
  const f = report.facts;
  const h = f.headings;
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card flex flex-col justify-center">
          <ScoreRing summary={report.summary} />
          {report.url && <p className="mt-4 truncate text-xs text-muted">{report.url}</p>}
          {report.fetch && (
            <p className="text-xs text-muted">HTTP {report.fetch.status} · {report.fetch.elapsedMs} ms · {report.fetch.redirects.length} redirects</p>
          )}
        </div>
        <div className="card">
          <h2 className="label">Search result preview</h2>
          <SerpPreview title={f.title} description={f.metaDescription} url={report.url ?? ""} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="card">
          <h2 className="mb-3 font-medium">Recommendations</h2>
          <CheckList checks={report.checks} />
        </div>
        <div className="space-y-6">
          <div className="card text-sm">
            <h2 className="mb-3 font-medium">Page stats</h2>
            <dl className="grid grid-cols-2 gap-y-2">
              <dt className="text-muted">Words</dt><dd className="text-right">{f.wordCount}</dd>
              <dt className="text-muted">Headings</dt><dd className="text-right">{h.length}</dd>
              <dt className="text-muted">Images</dt><dd className="text-right">{f.images.length}</dd>
              <dt className="text-muted">Internal links</dt><dd className="text-right">{f.links.filter((l) => l.internal).length}</dd>
              <dt className="text-muted">External links</dt><dd className="text-right">{f.links.filter((l) => !l.internal).length}</dd>
              <dt className="text-muted">Schema</dt><dd className="truncate text-right">{f.jsonLdTypes.join(", ") || "—"}</dd>
            </dl>
          </div>
          <div className="card text-sm">
            <h2 className="mb-3 font-medium">Top terms</h2>
            <div className="flex flex-wrap gap-1.5">
              {report.topTerms.map((t) => (
                <span key={t.term} className="chip">{t.term} · {t.count}</span>
              ))}
              {report.topTerms.length === 0 && <span className="text-muted">No body text found.</span>}
            </div>
          </div>
          <div className="card text-sm">
            <h2 className="mb-3 font-medium">Heading outline</h2>
            <ul className="max-h-72 space-y-1 overflow-auto">
              {h.map((x, i) => (
                <li key={i} style={{ paddingLeft: (x.level - 1) * 12 }} className="truncate">
                  <span className="mr-1 font-mono text-xs text-muted">H{x.level}</span>{x.text || <em className="text-muted">(empty)</em>}
                </li>
              ))}
              {h.length === 0 && <li className="text-muted">No headings.</li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
