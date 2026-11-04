"use client";

import { useMemo, useRef, useState } from "react";
import { crawl, type CrawlStats } from "@/lib/seo/crawler";
import type { RobotsRules } from "@/lib/seo/robots";
import { auditSite, type CrawledPage, type SiteIssue } from "@/lib/seo/site-audit";
import { gradeFor } from "@/lib/seo/score";
import { ScoreRing, scoreColor } from "@/components/ScoreRing";
import { downloadCsv } from "@/lib/csv";
import { SaveToProject } from "@/components/SaveToProject";

type Phase = "idle" | "discovering" | "crawling" | "done" | "stopped" | "error";
export interface Discovery {
  startUrl: string;
  origin: string;
  robotsFound: boolean;
  robots: RobotsRules;
  sitemapFiles: string[];
  sitemapUrls: string[];
}

const LIMITS = [25, 50, 100, 250, 500];
const SEV_STYLE: Record<SiteIssue["severity"], { cls: string; label: string }> = {
  fail: { cls: "bg-fail/15 text-fail", label: "Error" },
  warn: { cls: "bg-warn/15 text-warn", label: "Warning" },
  info: { cls: "bg-info/15 text-info", label: "Notice" },
};

export function AuditClient() {
  const [url, setUrl] = useState("");
  const [maxPages, setMaxPages] = useState(100);
  const [respectRobots, setRespectRobots] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [discovery, setDiscovery] = useState<Discovery | null>(null);
  const [pages, setPages] = useState<CrawledPage[]>([]);
  const [stats, setStats] = useState<CrawlStats | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const running = phase === "discovering" || phase === "crawling";

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPages([]);
    setStats(null);
    setDiscovery(null);
    setPhase("discovering");
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/audit/discover", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Couldn't start the audit.");
      setDiscovery(d);
      setPhase("crawling");

      const collected: CrawledPage[] = [];
      const result = await crawl({
        startUrl: d.startUrl,
        sitemapUrls: d.sitemapUrls,
        robots: d.robots,
        respectRobots,
        maxPages,
        concurrency: 4,
        signal: ctrl.signal,
        fetchOne: async (u, depth) => {
          const r = await fetch("/api/audit/page", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: u, depth }) });
          if (!r.ok) throw new Error(`Audit API returned ${r.status}`);
          return r.json();
        },
        onPage: (p, s) => {
          collected.push(p);
          setPages([...collected]);
          setStats({ ...s });
        },
      });
      setStats({ ...result.stats });
      setPhase(ctrl.signal.aborted ? "stopped" : "done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audit failed.");
      setPhase("error");
    }
  }

  const audit = useMemo(() => (pages.length ? auditSite(pages, { sitemapUrls: discovery?.sitemapUrls }) : null), [pages, discovery]);
  const progress = Math.min(100, Math.round((pages.length / maxPages) * 100));

  return (
    <div className="mt-6 space-y-6">
      <form onSubmit={start} className="card space-y-4">
        <div className="grid gap-4 md:grid-cols-[1fr_160px]">
          <div>
            <label className="label" htmlFor="site">Website</label>
            <input id="site" className="input" placeholder="https://yourstore.com" value={url} onChange={(e) => setUrl(e.target.value)} required disabled={running} />
          </div>
          <div>
            <label className="label" htmlFor="max">Page limit</label>
            <select id="max" className="input" value={maxPages} onChange={(e) => setMaxPages(Number(e.target.value))} disabled={running}>
              {LIMITS.map((n) => <option key={n} value={n}>{n} pages</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {running ? (
            <button type="button" className="btn-ghost" onClick={() => abortRef.current?.abort()}>Stop crawl</button>
          ) : (
            <button className="btn">{phase === "idle" ? "Start audit" : "Run again"}</button>
          )}
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={respectRobots} onChange={(e) => setRespectRobots(e.target.checked)} disabled={running} className="accent-[var(--accent)]" />
            Respect robots.txt
          </label>
        </div>
        {error && <p className="text-sm text-fail">{error}</p>}

        {phase !== "idle" && phase !== "error" && (
          <div className="space-y-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${phase === "discovering" ? 3 : phase === "done" ? 100 : progress}%` }} />
            </div>
            <p className="text-xs text-subtle">
              {phase === "discovering" && "Reading robots.txt and sitemap…"}
              {phase === "crawling" && `Crawling… ${pages.length} of up to ${maxPages} pages${stats ? ` · ${stats.queued} queued` : ""}`}
              {phase === "done" && `Finished: ${pages.length} pages crawled${pages.length >= maxPages ? " (page limit reached)" : ""}.`}
              {phase === "stopped" && `Stopped after ${pages.length} pages.`}
              {discovery && ` · robots.txt ${discovery.robotsFound ? "found" : "not found"} · sitemap: ${discovery.sitemapUrls.length ? `${discovery.sitemapUrls.length} URLs` : "not found"}`}
              {stats?.blockedByRobots.length ? ` · ${stats.blockedByRobots.length} blocked by robots.txt` : ""}
            </p>
          </div>
        )}
      </form>

      {audit && (
        <>
          {(phase === "done" || phase === "stopped") && discovery && (
            <div className="flex justify-end">
              <SaveToProject payload={siteAuditPayload(discovery, pages, audit)} />
            </div>
          )}
          <Results audit={audit} pages={pages} sitemapUrlCount={discovery?.sitemapUrls.length ?? 0} sitemapFileCount={discovery?.sitemapFiles.length ?? 0} />
        </>
      )}
    </div>
  );
}

/** Compact, size-capped version of a finished crawl for saving to a project. */
function siteAuditPayload(d: Discovery, pages: CrawledPage[], audit: ReturnType<typeof auditSite>) {
  const issueCount = audit.issues.filter((i) => i.severity !== "info").reduce((n, i) => n + i.items.length, 0);
  return {
    kind: "site" as const,
    url: d.startUrl,
    score: audit.healthScore,
    issueCount,
    data: {
      startUrl: d.startUrl,
      robotsFound: d.robotsFound,
      sitemapUrlCount: d.sitemapUrls.length,
      sitemapFileCount: d.sitemapFiles.length,
      // Link lists are what make crawls big; keep only counts.
      pages: pages.map(({ internalLinks, ...p }) => ({ ...p, internalLinks: [], linkCount: internalLinks.length })),
      audit: { ...audit, issues: audit.issues.map((i) => ({ ...i, items: i.items.slice(0, 300), total: i.items.length })) },
    },
  };
}

export function Results({ audit, pages, sitemapUrlCount, sitemapFileCount }: { audit: ReturnType<typeof auditSite>; pages: CrawledPage[]; sitemapUrlCount: number; sitemapFileCount: number }) {
  const counts = { fail: 0, warn: 0, info: 0 };
  for (const i of audit.issues) counts[i.severity] += (i as SiteIssue & { total?: number }).total ?? i.items.length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr_1fr]">
        <div className="card">
          <ScoreRing
            label="Site health"
            summary={{ score: audit.healthScore, grade: gradeFor(audit.healthScore), counts: { pass: 0, warn: 0, fail: 0, info: 0 } }}
            legend={<><span><b className="text-fail">{counts.fail}</b> errors</span><span><b className="text-warn">{counts.warn}</b> warnings</span><span><b className="text-info">{counts.info}</b> notices</span></>}
          />
        </div>
        <Tile label="Pages crawled" value={audit.pages} sub={`${audit.okPages} OK`} />
        <Tile label="Avg. page score" value={audit.avgPageScore} color={scoreColor(audit.avgPageScore)} />
        <Tile label="Sitemap URLs" value={sitemapUrlCount} sub={sitemapFileCount ? `${sitemapFileCount} file(s)` : "No sitemap found"} />
      </div>

      <div className="card">
        <h2 className="mb-3 font-medium">Issues</h2>
        {audit.issues.length === 0 ? <p className="text-sm text-muted">No issues found.</p> : (
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {audit.issues.map((i) => <IssueRow key={i.id} issue={i} />)}
          </div>
        )}
      </div>

      <PagesTable pages={pages} />
    </div>
  );
}

function Tile({ label, value, sub, color }: { label: string; value: number; sub?: string; color?: string }) {
  return (
    <div className="card flex flex-col justify-center">
      <div className="label">{label}</div>
      <div className="text-3xl font-semibold tabular-nums" style={color ? { color } : undefined}>{value.toLocaleString("en-US")}</div>
      {sub && <div className="text-xs text-subtle">{sub}</div>}
    </div>
  );
}

function IssueRow({ issue }: { issue: SiteIssue }) {
  const [open, setOpen] = useState(false);
  const s = SEV_STYLE[issue.severity];
  return (
    <div className="bg-surface-2/40">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 p-3 text-left text-sm">
        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase ${s.cls}`}>{s.label}</span>
        <span className="flex-1 font-medium">{issue.label}</span>
        <span className="tabular-nums text-muted">{(issue as SiteIssue & { total?: number }).total ?? issue.items.length}</span>
        <span className="text-subtle">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="space-y-2 px-3 pb-3 text-sm">
          <p className="text-muted">{issue.description}</p>
          <p><span className="font-medium text-accent">Fix: </span>{issue.fix}</p>
          <ul className="max-h-72 space-y-1 overflow-auto rounded-lg border border-border bg-background/60 p-2 font-mono text-xs">
            {issue.items.slice(0, 500).map((x, idx) => (
              <li key={idx} className="break-all"><a href={x.url} target="_blank" rel="noreferrer" className="hover:text-accent">{x.url}</a>{x.detail && <span className="text-subtle"> {x.detail}</span>}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PagesTable({ pages }: { pages: CrawledPage[] }) {
  const [filter, setFilter] = useState<"all" | "errors" | "redirects">("all");
  const [q, setQ] = useState("");
  const rows = pages
    .filter((p) => (filter === "errors" ? p.status >= 400 || p.status === 0 : filter === "redirects" ? p.redirects > 0 : true))
    .filter((p) => !q || p.url.toLowerCase().includes(q.toLowerCase()) || p.title?.toLowerCase().includes(q.toLowerCase()));

  function exportCsv() {
    downloadCsv("site-audit-pages.csv", [
      ["url", "status", "score", "title", "meta_description", "words", "h1_count", "depth", "response_ms", "redirects", "noindex", "canonical", "error"],
      ...pages.map((p) => [p.url, p.status, p.score ?? "", p.title ?? "", p.metaDescription ?? "", p.wordCount ?? "", p.h1Count ?? "", p.depth, p.elapsedMs ?? "", p.redirects, p.noindex ? "yes" : "", p.canonical ?? "", p.error ?? ""]),
    ]);
  }

  return (
    <div className="card overflow-x-auto p-0">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <h2 className="mr-auto font-medium">Crawled pages</h2>
        {(["all", "errors", "redirects"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`pill ${filter === f ? "pill-on" : "pill-off"}`}>{f[0].toUpperCase() + f.slice(1)}</button>
        ))}
        <input className="input w-48" placeholder="Search URL or title" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-ghost" onClick={exportCsv}>Export CSV</button>
      </div>
      <table className="w-full min-w-[760px] text-sm">
        <thead className="border-y border-border text-left text-[11px] uppercase tracking-wide text-subtle">
          <tr><th className="p-3">Status</th><th className="p-3">Score</th><th className="p-3">URL / title</th><th className="p-3 text-right">Words</th><th className="p-3 text-right">Depth</th><th className="p-3 text-right">Time</th></tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.slice(0, 1000).map((p) => (
            <tr key={p.url} className="align-top">
              <td className="p-3"><StatusBadge p={p} /></td>
              <td className="p-3">{p.score !== undefined ? <span className="score-badge" style={{ background: scoreColor(p.score) }}>{p.score}</span> : <span className="text-subtle">—</span>}</td>
              <td className="max-w-md p-3">
                <a href={p.url} target="_blank" rel="noreferrer" className="block break-all font-mono text-xs hover:text-accent">{p.url}</a>
                <span className="text-xs text-muted">{p.error ?? p.title ?? ""}</span>
              </td>
              <td className="p-3 text-right tabular-nums text-muted">{p.wordCount ?? "—"}</td>
              <td className="p-3 text-right tabular-nums text-muted">{p.depth < 0 ? "sitemap" : p.depth}</td>
              <td className="p-3 text-right tabular-nums text-muted">{p.elapsedMs ? `${p.elapsedMs} ms` : "—"}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted">No pages match.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ p }: { p: CrawledPage }) {
  const cls = p.status === 0 || p.status >= 400 ? "bg-fail/15 text-fail" : p.redirects > 0 ? "bg-warn/15 text-warn" : "bg-pass/15 text-pass";
  return <span className={`rounded-md px-1.5 py-0.5 font-mono text-xs ${cls}`}>{p.status === 0 ? "ERR" : p.status}{p.redirects > 0 ? " ↪" : ""}</span>;
}
