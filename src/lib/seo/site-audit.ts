/**
 * Site Audit: per-page summaries and site-wide issue detection (pure).
 * The crawl itself is driven by the client one page at a time (see app/audit), so no
 * single request runs long enough to hit serverless timeouts.
 */
import type { PageReport } from "./analyze-page";
import type { Severity } from "./types";

export interface CrawledPage {
  url: string; // URL as queued (normalized)
  finalUrl?: string; // after redirects
  depth: number; // clicks from start page (-1 = found only via sitemap)
  status: number; // HTTP status; 0 = fetch error / skipped
  error?: string;
  redirects: number;
  elapsedMs?: number;
  title?: string;
  metaDescription?: string;
  h1Count?: number;
  wordCount?: number;
  canonical?: string;
  noindex?: boolean;
  score?: number;
  geoScore?: number;
  imagesMissingAlt?: number;
  internalLinks: string[];
  externalLinks?: number;
}

export interface SiteIssue {
  id: string;
  label: string;
  severity: Exclude<Severity, "pass">;
  description: string;
  fix: string;
  items: { url: string; detail?: string }[];
}

export interface SiteAuditResult {
  pages: number;
  okPages: number;
  healthScore: number; // 0-100
  avgPageScore: number;
  avgGeoScore: number | null;
  issues: SiteIssue[];
}

const NON_PAGE_EXT = /\.(jpe?g|png|gif|webp|avif|svg|ico|pdf|zip|gz|rar|mp4|mp3|mov|webm|css|js|json|xml|txt|woff2?|ttf|eot|csv|xlsx?|docx?|pptx?)$/i;

export function sameSite(a: string, b: string): boolean {
  try {
    return new URL(a).hostname.replace(/^www\./, "") === new URL(b).hostname.replace(/^www\./, "");
  } catch {
    return false;
  }
}

/**
 * Normalize a URL for crawl de-duplication: drop the hash, (optionally) the query, and a trailing
 * slash on non-root paths. Returns null for non-http(s) or non-page resources.
 */
export function normalizeCrawlUrl(raw: string, opts: { keepQuery?: boolean } = {}): string | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (NON_PAGE_EXT.test(u.pathname)) return null;
  u.hash = "";
  if (!opts.keepQuery) u.search = "";
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) u.pathname = u.pathname.replace(/\/+$/, "");
  u.hostname = u.hostname.toLowerCase();
  return u.href;
}

/** Compact per-page summary returned by the crawl API. */
export function summarizeReport(
  report: PageReport,
  fetched: { requestedUrl: string; status: number; redirects: number; elapsedMs: number; depth: number },
): CrawledPage {
  const f = report.facts;
  const base = report.url ?? fetched.requestedUrl;
  const internal = new Set<string>();
  let external = 0;
  for (const l of f.links) {
    if (l.nofollow) continue;
    if (!sameSite(l.href, base)) { if (/^https?:/i.test(l.href)) external++; continue; }
    const n = normalizeCrawlUrl(l.href);
    if (n) internal.add(n);
    if (internal.size >= 500) break;
  }
  return {
    url: fetched.requestedUrl,
    finalUrl: report.url,
    depth: fetched.depth,
    status: fetched.status,
    redirects: fetched.redirects,
    elapsedMs: fetched.elapsedMs,
    title: f.title,
    metaDescription: f.metaDescription,
    h1Count: f.headings.filter((h) => h.level === 1).length,
    wordCount: f.wordCount,
    canonical: f.canonical,
    noindex: /noindex/i.test(f.robots ?? ""),
    score: report.summary.score,
    geoScore: report.geo?.summary.score,
    imagesMissingAlt: f.images.filter((i) => i.alt === null).length,
    internalLinks: [...internal],
    externalLinks: external,
  };
}

const THIN_WORDS = 250;
const SLOW_MS = 1500;

export function auditSite(pages: CrawledPage[], opts: { sitemapUrls?: string[] } = {}): SiteAuditResult {
  const issues: SiteIssue[] = [];
  const byUrl = new Map(pages.map((p) => [p.url, p]));
  const ok = pages.filter((p) => p.status >= 200 && p.status < 300 && !p.error);
  const indexable = ok.filter((p) => !p.noindex);

  const add = (i: Omit<SiteIssue, "items">, items: SiteIssue["items"]) => {
    if (items.length) issues.push({ ...i, items });
  };

  add(
    { id: "broken-pages", label: "Broken pages (4xx/5xx)", severity: "fail",
      description: "These URLs return an error status.", fix: "Restore the page, or 301-redirect it to the closest relevant page and update links." },
    pages.filter((p) => p.status >= 400).map((p) => ({ url: p.url, detail: `HTTP ${p.status}` })),
  );
  add(
    { id: "fetch-errors", label: "Pages that couldn't be fetched", severity: "fail",
      description: "The server didn't respond, timed out, or returned something other than HTML.", fix: "Check the URL loads in a browser; fix server errors or timeouts." },
    pages.filter((p) => p.status === 0 && p.error).map((p) => ({ url: p.url, detail: p.error })),
  );

  // Link-level issues: internal links pointing at broken or redirecting URLs.
  const brokenLinks: SiteIssue["items"] = [];
  const redirectLinks: SiteIssue["items"] = [];
  for (const src of ok) {
    for (const target of src.internalLinks) {
      const t = byUrl.get(target);
      if (!t) continue;
      if (t.status >= 400) brokenLinks.push({ url: src.url, detail: `→ ${target} (HTTP ${t.status})` });
      else if (t.redirects > 0) redirectLinks.push({ url: src.url, detail: `→ ${target} redirects to ${t.finalUrl ?? "?"}` });
    }
  }
  add({ id: "broken-links", label: "Internal links to broken pages", severity: "fail",
    description: "Links on your site point to pages that return errors. These waste crawl budget and frustrate visitors.",
    fix: "Update each link to a working URL." }, brokenLinks);
  add({ id: "redirect-links", label: "Internal links that redirect", severity: "warn",
    description: "Links point at URLs that redirect, adding a hop for users and crawlers.",
    fix: "Point links directly at the final URL." }, redirectLinks);

  // Duplicates among indexable pages.
  const dupes = (key: (p: CrawledPage) => string | undefined) => {
    const groups = new Map<string, CrawledPage[]>();
    for (const p of indexable) {
      const k = key(p)?.trim().toLowerCase();
      if (!k) continue;
      groups.set(k, [...(groups.get(k) ?? []), p]);
    }
    return [...groups.entries()].filter(([, g]) => g.length > 1).flatMap(([k, g]) => g.map((p) => ({ url: p.url, detail: `“${k.slice(0, 80)}” (×${g.length})` })));
  };
  add({ id: "duplicate-titles", label: "Duplicate titles", severity: "warn",
    description: "Several pages share the same title, so search engines can't tell them apart.",
    fix: "Give every page a unique title that reflects its specific content." }, dupes((p) => p.title));
  add({ id: "duplicate-meta", label: "Duplicate meta descriptions", severity: "warn",
    description: "Several pages share the same meta description.", fix: "Write a unique description for each page." }, dupes((p) => p.metaDescription));

  add({ id: "missing-title", label: "Missing title", severity: "fail", description: "Pages without a <title>.", fix: "Add a unique, descriptive title." },
    indexable.filter((p) => !p.title).map((p) => ({ url: p.url })));
  add({ id: "missing-meta", label: "Missing meta description", severity: "warn", description: "Pages without a meta description.", fix: "Add a 120–160 character summary." },
    indexable.filter((p) => !p.metaDescription).map((p) => ({ url: p.url })));
  add({ id: "missing-h1", label: "Missing H1", severity: "warn", description: "Pages without a main heading.", fix: "Add one H1 describing the page." },
    indexable.filter((p) => p.h1Count === 0).map((p) => ({ url: p.url })));
  add({ id: "multiple-h1", label: "Multiple H1s", severity: "warn", description: "Pages with more than one H1.", fix: "Keep one H1; demote the rest to H2." },
    indexable.filter((p) => (p.h1Count ?? 0) > 1).map((p) => ({ url: p.url, detail: `${p.h1Count} H1s` })));
  add({ id: "thin-content", label: "Thin content", severity: "warn", description: `Indexable pages with fewer than ${THIN_WORDS} words.`,
    fix: "Expand with genuinely useful detail, or noindex/merge pages that don't need to rank." },
    indexable.filter((p) => (p.wordCount ?? 0) < THIN_WORDS).map((p) => ({ url: p.url, detail: `${p.wordCount} words` })));
  add({ id: "missing-canonical", label: "Missing canonical tag", severity: "warn", description: "Pages without rel=canonical.",
    fix: "Add a self-referencing canonical to every indexable page." }, indexable.filter((p) => !p.canonical).map((p) => ({ url: p.url })));
  add({ id: "images-alt", label: "Images missing alt text", severity: "warn", description: "Pages with images lacking alt attributes.",
    fix: "Add descriptive alt text (alt=\"\" for decorative images)." },
    ok.filter((p) => (p.imagesMissingAlt ?? 0) > 0).map((p) => ({ url: p.url, detail: `${p.imagesMissingAlt} image(s)` })));
  add({ id: "slow-pages", label: "Slow server response", severity: "warn", description: `Pages that took over ${SLOW_MS / 1000}s to respond.`,
    fix: "Add caching/CDN and investigate slow backend queries." },
    ok.filter((p) => (p.elapsedMs ?? 0) > SLOW_MS).map((p) => ({ url: p.url, detail: `${p.elapsedMs} ms` })));
  add({ id: "redirect-chains", label: "Redirect chains", severity: "warn", description: "URLs that redirect more than once.",
    fix: "Redirect straight to the final destination." },
    pages.filter((p) => p.redirects > 1).map((p) => ({ url: p.url, detail: `${p.redirects} hops` })));
  add({ id: "noindex", label: "Noindex pages", severity: "info", description: "Pages excluded from search results. Fine for carts, accounts and filters; a problem for products or categories.",
    fix: "Confirm each one is intentional." }, ok.filter((p) => p.noindex).map((p) => ({ url: p.url })));
  add({ id: "canonicalized", label: "Canonicalized to another URL", severity: "info", description: "Pages whose canonical points elsewhere, so they won't rank themselves.",
    fix: "Make sure the canonical target is the version you want indexed." },
    ok.filter((p) => p.canonical && normalizeCrawlUrl(p.canonical) && normalizeCrawlUrl(p.canonical) !== normalizeCrawlUrl(p.finalUrl ?? p.url))
      .map((p) => ({ url: p.url, detail: `→ ${p.canonical}` })));

  // Orphans: pages reached (e.g. via sitemap) that no crawled page links to.
  const linked = new Set(ok.flatMap((p) => p.internalLinks));
  add({ id: "orphans", label: "Orphan pages", severity: "warn",
    description: "Pages no other crawled page links to. Search engines find and value them less.",
    fix: "Link to them from relevant category pages, navigation or related content." },
    indexable.filter((p) => p.depth !== 0 && !linked.has(p.url)).map((p) => ({ url: p.url, detail: p.depth === -1 ? "found only in sitemap" : undefined })));

  if (opts.sitemapUrls?.length) {
    const inSitemap = new Set(opts.sitemapUrls.map((u) => normalizeCrawlUrl(u)).filter(Boolean));
    add({ id: "not-in-sitemap", label: "Indexable pages missing from sitemap", severity: "info",
      description: "Crawlable pages that aren't listed in your XML sitemap.", fix: "Add them to the sitemap (or noindex them if they shouldn't rank)." },
      indexable.filter((p) => !inSitemap.has(p.url) && !inSitemap.has(normalizeCrawlUrl(p.finalUrl ?? "") ?? "")).map((p) => ({ url: p.url })));
  }

  const rank: Record<SiteIssue["severity"], number> = { fail: 0, warn: 1, info: 2 };
  issues.sort((a, b) => rank[a.severity] - rank[b.severity] || b.items.length - a.items.length);

  const avgPageScore = ok.length ? Math.round(ok.reduce((n, p) => n + (p.score ?? 0), 0) / ok.length) : 0;
  // Health: share of crawled pages free of any fail/warn-level site issue, blended with page scores.
  const flagged = new Set(issues.filter((i) => i.severity !== "info").flatMap((i) => i.items.map((x) => x.url)));
  const clean = pages.length ? (pages.length - [...flagged].filter((u) => byUrl.has(u)).length) / pages.length : 0;
  const healthScore = pages.length ? Math.round(clean * 50 + avgPageScore * 0.5) : 0;

  const geo = ok.map((p) => p.geoScore).filter((n): n is number => typeof n === "number");
  const avgGeoScore = geo.length ? Math.round(geo.reduce((a, b) => a + b, 0) / geo.length) : null;
  return { pages: pages.length, okPages: ok.length, healthScore, avgPageScore, avgGeoScore, issues };
}
