/**
 * Breadth-first crawl orchestrator. Runs in the browser and calls `fetchOne` (our API) per page,
 * so each server request is short. Pure apart from the injected fetch function, so it's testable.
 */
import { isAllowed, type RobotsRules } from "./robots";
import { normalizeCrawlUrl, sameSite, type CrawledPage } from "./site-audit";

export interface CrawlOptions {
  startUrl: string;
  sitemapUrls?: string[];
  robots?: RobotsRules;
  respectRobots?: boolean;
  maxPages: number;
  concurrency?: number;
  fetchOne: (url: string, depth: number) => Promise<CrawledPage>;
  onPage?: (page: CrawledPage, stats: CrawlStats) => void;
  signal?: AbortSignal;
}

export interface CrawlStats {
  crawled: number;
  queued: number;
  blockedByRobots: string[];
}

export async function crawl(opts: CrawlOptions): Promise<{ pages: CrawledPage[]; stats: CrawlStats }> {
  const { startUrl, maxPages, fetchOne, onPage, signal } = opts;
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? 4, 8));
  const start = normalizeCrawlUrl(startUrl) ?? startUrl;

  const seen = new Set<string>();
  const queue: { url: string; depth: number }[] = [];
  const pages: CrawledPage[] = [];
  const stats: CrawlStats = { crawled: 0, queued: 0, blockedByRobots: [] };
  let sitemapAdded = false;

  const enqueue = (raw: string, depth: number) => {
    const url = normalizeCrawlUrl(raw);
    if (!url || seen.has(url) || !sameSite(url, start)) return;
    seen.add(url);
    if (opts.respectRobots !== false && opts.robots) {
      const u = new URL(url);
      if (!isAllowed(opts.robots, u.pathname + u.search)) {
        stats.blockedByRobots.push(url);
        return;
      }
    }
    queue.push({ url, depth });
  };

  enqueue(start, 0);

  let inFlight = 0;
  const next = () => {
    // Only once the link graph is fully exhausted (nothing queued AND nothing in flight that could
    // add links) fall back to sitemap URLs. Those are pages not reachable by links: orphans.
    if (!queue.length && inFlight === 0 && !sitemapAdded) {
      sitemapAdded = true;
      for (const u of opts.sitemapUrls ?? []) enqueue(u, -1);
    }
    return queue.shift();
  };

  await new Promise<void>((resolve) => {
    const pump = () => {
      if (signal?.aborted) { if (inFlight === 0) resolve(); return; }
      while (inFlight < concurrency && pages.length + inFlight < maxPages) {
        const job = next();
        if (!job) break;
        inFlight++;
        fetchOne(job.url, job.depth)
          .catch((e): CrawledPage => ({ url: job.url, depth: job.depth, status: 0, error: e instanceof Error ? e.message : "Request failed", redirects: 0, internalLinks: [] }))
          .then((page) => {
            inFlight--;
            if (signal?.aborted && pages.length >= maxPages) return pump();
            pages.push(page);
            stats.crawled = pages.length;
            if (page.status >= 200 && page.status < 400) {
              const childDepth = job.depth < 0 ? -1 : job.depth + 1;
              for (const l of page.internalLinks) enqueue(l, childDepth);
            }
            stats.queued = queue.length;
            onPage?.(page, stats);
            pump();
          });
      }
      if (inFlight === 0 && (!queue.length || pages.length >= maxPages)) {
        // Nothing running and nothing left (or limit hit). Check the sitemap fallback once more.
        if (pages.length < maxPages && !sitemapAdded && !signal?.aborted) { pump(); return; }
        resolve();
      }
    };
    pump();
  });

  stats.queued = queue.length;
  return { pages, stats };
}
