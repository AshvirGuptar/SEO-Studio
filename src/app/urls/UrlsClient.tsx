"use client";

import { useMemo, useState } from "react";
import { analyzeUrl, slugify, suggestUrl } from "@/lib/seo/slug";
import { summarize } from "@/lib/seo/score";
import { scoreColor } from "@/components/ScoreRing";

const SAMPLE = `https://shop.example.com/Products/Mens_Waterproof_Hiking_Boot_12345.html
https://shop.example.com/c/footwear?cat=22&sort=price
/blog/the-10-best-ways-to-clean-and-care-for-your-leather-hiking-boots-this-winter`;

export function UrlsClient() {
  const [input, setInput] = useState(SAMPLE);
  const [keyword, setKeyword] = useState("");
  const [title, setTitle] = useState("");
  const [open, setOpen] = useState<number | null>(null);

  const rows = useMemo(() => {
    const kw = keyword.trim() || undefined;
    return input.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 500).map((u) => {
      const checks = analyzeUrl(u, kw);
      const suggestion = suggestUrl(u, { keyword: kw, title: title.trim() || undefined });
      return { url: u, checks, summary: summarize(checks), suggestion, after: summarize(analyzeUrl(suggestion, kw)).score };
    });
  }, [input, keyword, title]);

  function exportCsv() {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const csv = ["old_url,new_url,score_before,score_after", ...rows.map((r) => [esc(r.url), esc(r.suggestion), r.summary.score, r.after].join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "url-redirect-map.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="card space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="kw">Target keyword (optional)</label>
            <input id="kw" className="input" placeholder="hiking boots" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="title">Page title → slug (optional)</label>
            <input id="title" className="input" placeholder="Men's Waterproof Hiking Boots" value={title} onChange={(e) => setTitle(e.target.value)} />
            {title && <p className="mt-1 font-mono text-xs text-muted">/{slugify(title)}</p>}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="urls">URLs (one per line, up to 500)</label>
          <textarea id="urls" className="input h-36 font-mono text-xs" value={input} onChange={(e) => setInput(e.target.value)} />
        </div>
      </div>

      <div className="card overflow-x-auto p-0">
        <div className="flex items-center justify-between p-4">
          <h2 className="font-medium">{rows.length} URL{rows.length === 1 ? "" : "s"}</h2>
          <button className="btn-ghost" onClick={exportCsv} disabled={rows.length === 0}>Export redirect map (CSV)</button>
        </div>
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-y border-border text-left text-xs uppercase text-muted">
            <tr><th className="p-3">Score</th><th className="p-3">Current URL</th><th className="p-3">Suggested</th><th className="p-3">Issues</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r, i) => {
              const issues = r.checks.filter((c) => c.severity === "fail" || c.severity === "warn");
              return (
                <tr key={i} className="align-top">
                  <td className="p-3">
                    <span className="rounded-full px-2 py-0.5 text-xs font-semibold text-white" style={{ background: scoreColor(r.summary.score) }}>{r.summary.score}</span>
                    {r.after > r.summary.score && <div className="mt-1 text-xs text-pass">→ {r.after}</div>}
                  </td>
                  <td className="max-w-xs break-all p-3 font-mono text-xs">{r.url}</td>
                  <td className="max-w-xs break-all p-3 font-mono text-xs text-accent">
                    {r.suggestion}
                    <button className="ml-2 text-muted hover:text-foreground" onClick={() => navigator.clipboard.writeText(r.suggestion)} title="Copy">⧉</button>
                  </td>
                  <td className="p-3">
                    <button className="text-xs text-muted hover:text-foreground" onClick={() => setOpen(open === i ? null : i)}>
                      {issues.length} issue{issues.length === 1 ? "" : "s"} {open === i ? "▴" : "▾"}
                    </button>
                    {open === i && (
                      <ul className="mt-2 space-y-1 text-xs">
                        {issues.map((c) => <li key={c.id}><b className={c.severity === "fail" ? "text-fail" : "text-warn"}>{c.label}:</b> {c.fix ?? c.message}</li>)}
                        {issues.length === 0 && <li className="text-muted">Looks good.</li>}
                      </ul>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
