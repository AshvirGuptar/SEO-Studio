"use client";

import { useMemo, useState } from "react";
import { CheckList } from "@/components/CheckList";
import { CrawlerTable } from "@/components/CrawlerTable";
import { AI_CRAWLERS } from "@/lib/seo/geo";
import { buildAiRobots, buildLlmsTxt, defaultPolicy, parsePageList, verifyAiRobots, type CrawlerPolicy } from "@/lib/seo/ai-access";
import { CodeBlock, CopyButton, DownloadButton } from "./ui";

/** AI access kit: robots.txt rules for AI crawlers (search vs training) and an llms.txt generator. */
export function AccessKitPanel() {
  return (
    <div className="space-y-8">
      <RobotsBuilder />
      <LlmsBuilder />
    </div>
  );
}

function RobotsBuilder() {
  const [policy, setPolicy] = useState<CrawlerPolicy>(() => defaultPolicy(false));
  const [existing, setExisting] = useState("");
  const [sitemap, setSitemap] = useState("");
  const [site, setSite] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const txt = useMemo(() => buildAiRobots({ policy, existing, sitemapUrl: sitemap }), [policy, existing, sitemap]);
  const verified = useMemo(() => verifyAiRobots(txt, policy), [txt, policy]);
  const setKind = (kind: "search" | "training", allowed: boolean) =>
    setPolicy((p) => ({ ...p, ...Object.fromEntries(AI_CRAWLERS.filter((c) => c.kind === kind).map((c) => [c.token, allowed])) }));
  const all = (kind: "search" | "training", allowed: boolean) => AI_CRAWLERS.filter((c) => c.kind === kind).every((c) => policy[c.token] === allowed);

  async function loadFromSite() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/audit/discover", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: site }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? "Couldn't load that site.");
      setExisting(data.robotsTxt ?? "");
      if (!sitemap && data.sitemapFiles?.[0]) setSitemap(data.sitemapFiles[0]);
      if (!data.robotsFound) setError("That site has no robots.txt yet; the generated file starts fresh.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load that site.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4" aria-labelledby="robots-h">
      <div>
        <h2 id="robots-h" className="text-lg font-medium">AI crawler rules (robots.txt)</h2>
        <p className="text-sm text-muted">AI <b>search</b> bots fetch pages to answer and cite them; keep them allowed to show up in AI answers. <b>Training</b> bots collect data for future models; blocking them is a business choice and doesn&apos;t affect citations.</p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="min-w-0 space-y-4">
          <div className="card space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Choice title="AI search bots" note="ChatGPT search, Perplexity, Claude…" allowOn={all("search", true)} blockOn={all("search", false)} onChange={(v) => setKind("search", v)} />
              <Choice title="AI training bots" note="GPTBot, ClaudeBot, CCBot…" allowOn={all("training", true)} blockOn={all("training", false)} onChange={(v) => setKind("training", v)} />
            </div>
            <details>
              <summary className="flex min-h-8 cursor-pointer items-center text-sm text-muted">Choose bot by bot</summary>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                {AI_CRAWLERS.map((c) => (
                  <li key={c.token}>
                    <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm hover:bg-surface-2">
                      <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={policy[c.token] ?? true} onChange={(e) => setPolicy({ ...policy, [c.token]: e.target.checked })} />
                      <span className="min-w-0">
                        <span className="font-mono text-xs">{c.token}</span>
                        <span className="block truncate text-xs text-subtle">{c.owner} · {c.kind}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </details>
          </div>

          <div className="card space-y-3">
            <div>
              <label className="label" htmlFor="kit-site">Load the current robots.txt from a site (optional)</label>
              <div className="flex flex-wrap gap-2">
                <input id="kit-site" className="input min-w-0 flex-1" placeholder="example.com" value={site} onChange={(e) => setSite(e.target.value)} />
                <button className="btn-ghost" disabled={!site.trim() || loading} onClick={loadFromSite}>{loading ? "Loading…" : "Load"}</button>
              </div>
              {error && <p className="mt-2 text-sm text-muted" role="status">{error}</p>}
            </div>
            <div>
              <label className="label" htmlFor="kit-existing">Current robots.txt (merged: other rules are kept, old AI rules replaced)</label>
              <textarea id="kit-existing" className="input h-32 font-mono text-xs" placeholder={"User-agent: *\nDisallow: /cart"} value={existing} onChange={(e) => setExisting(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="kit-sitemap">Sitemap URL</label>
              <input id="kit-sitemap" className="input" type="url" placeholder="https://example.com/sitemap.xml" value={sitemap} onChange={(e) => setSitemap(e.target.value)} />
            </div>
          </div>
        </div>

        <aside className="min-w-0 space-y-4">
          <div className="card space-y-3">
            <h3 className="font-medium">robots.txt</h3>
            <CodeBlock code={txt} label="Generated robots.txt" />
            <div className="flex flex-wrap gap-2">
              <CopyButton text={txt} className="btn" />
              <DownloadButton text={txt} filename="robots.txt" label="Download robots.txt" />
            </div>
            <p className="text-xs text-subtle">Upload it to your site root (/robots.txt). Checked below with the same matcher the Page Analyzer and Site Audit use.</p>
          </div>
          <div className="card"><CheckList checks={verified.checks} groupByCategory={false} /></div>
          <div className="card"><CrawlerTable crawlers={verified.crawlers} /></div>
        </aside>
      </div>
    </section>
  );
}

function Choice({ title, note, allowOn, blockOn, onChange }: { title: string; note: string; allowOn: boolean; blockOn: boolean; onChange: (allowed: boolean) => void }) {
  return (
    <fieldset className="min-w-0 rounded-xl border border-border p-3">
      <legend className="px-1 text-sm font-medium">{title}</legend>
      <p className="text-xs text-subtle">{note}</p>
      <div className="mt-2 flex gap-2">
        <button type="button" className={`pill ${allowOn ? "pill-on" : "pill-off"}`} aria-pressed={allowOn} onClick={() => onChange(true)}>Allow all</button>
        <button type="button" className={`pill ${blockOn ? "pill-on" : "pill-off"}`} aria-pressed={blockOn} onClick={() => onChange(false)}>Block all</button>
        {!allowOn && !blockOn && <span className="self-center text-xs text-subtle">Mixed</span>}
      </div>
    </fieldset>
  );
}

function LlmsBuilder() {
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [pagesText, setPagesText] = useState("");
  const pages = useMemo(() => parsePageList(pagesText), [pagesText]);
  const txt = useMemo(() => buildLlmsTxt({ siteName: name, summary, details, pages }), [name, summary, details, pages]);

  async function importFile(file: File | undefined) {
    if (file) setPagesText(await file.text());
  }

  return (
    <section className="space-y-4" aria-labelledby="llms-h">
      <div>
        <h2 id="llms-h" className="text-lg font-medium">llms.txt</h2>
        <p className="text-sm text-muted">A short Markdown guide to your most useful pages for AI tools (an emerging convention from llmstxt.org; optional, not required by major engines). Build it from a Site Audit: run the crawl, choose <b>Export CSV</b> on the pages table, and import it here.</p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="card min-w-0 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <label className="label" htmlFor="llms-name">Site name</label>
              <input id="llms-name" className="input" placeholder="Example PC" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="min-w-0">
              <label className="label" htmlFor="llms-summary">One-sentence summary</label>
              <input id="llms-summary" className="input" placeholder="PC parts and prebuilt gaming PCs, shipped across the US." value={summary} onChange={(e) => setSummary(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="llms-details">More context (optional)</label>
            <textarea id="llms-details" className="input h-20" placeholder="Who you serve, what makes the site authoritative, how to contact you…" value={details} onChange={(e) => setDetails(e.target.value)} />
          </div>
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <label className="label" htmlFor="llms-pages">Pages</label>
              <label className="btn-ghost cursor-pointer">
                Import Site Audit CSV
                <input type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={(e) => importFile(e.target.files?.[0])} />
              </label>
            </div>
            <textarea id="llms-pages" className="input h-40 font-mono text-xs" value={pagesText} onChange={(e) => setPagesText(e.target.value)}
              placeholder={"One per line: URL | Title | Description\nhttps://example.com/ | Home | PC parts store\nhttps://example.com/products/aurora | Aurora 12GB | 1440p graphics card\n\n…or paste / import a Site Audit CSV export"} />
            <p className="mt-1 text-xs text-subtle">{pages.length} page{pages.length === 1 ? "" : "s"} · from a Site Audit CSV, only indexable pages that returned 200 are kept. Sections come from the URL path.</p>
          </div>
        </div>
        <aside className="card min-w-0 space-y-3">
          <h3 className="font-medium">llms.txt</h3>
          <CodeBlock code={txt} label="Generated llms.txt" />
          <div className="flex flex-wrap gap-2">
            <CopyButton text={txt} className="btn" />
            <DownloadButton text={txt} filename="llms.txt" label="Download llms.txt" type="text/markdown" />
          </div>
          <p className="text-xs text-subtle">Upload it to your site root (/llms.txt). Keep it to the pages you&apos;d want an AI to read first.</p>
        </aside>
      </div>
    </section>
  );
}
