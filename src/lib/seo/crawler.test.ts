import { describe, expect, it } from "vitest";
import { crawl } from "./crawler";
import { parseRobots } from "./robots";
import type { CrawledPage } from "./site-audit";

// Fake site: url -> links (status 200 unless listed in STATUS)
const SITE: Record<string, string[]> = {
  "https://s.com/": ["https://s.com/a", "https://s.com/b", "https://other.com/x", "https://s.com/a#frag"],
  "https://s.com/a": ["https://s.com/c", "https://s.com/"],
  "https://s.com/b": ["https://s.com/private/x", "https://s.com/missing"],
  "https://s.com/c": [],
  "https://s.com/orphan": [],
  "https://s.com/private/x": [],
};
const STATUS: Record<string, number> = { "https://s.com/missing": 404 };

const fetchOne = async (url: string, depth: number): Promise<CrawledPage> => ({
  url, depth, status: STATUS[url] ?? (SITE[url] ? 200 : 404), redirects: 0, internalLinks: SITE[url] ?? [],
});

describe("crawl", () => {
  it("crawls breadth-first, stays on site, respects robots, then visits sitemap-only pages", async () => {
    const { pages, stats } = await crawl({
      startUrl: "https://s.com",
      sitemapUrls: ["https://s.com/orphan", "https://s.com/a"],
      robots: parseRobots("User-agent: *\nDisallow: /private"),
      maxPages: 50,
      fetchOne,
    });
    const byUrl = Object.fromEntries(pages.map((p) => [p.url, p.depth]));
    expect(byUrl).toEqual({
      "https://s.com/": 0, "https://s.com/a": 1, "https://s.com/b": 1, "https://s.com/c": 2,
      "https://s.com/missing": 2, "https://s.com/orphan": -1,
    });
    expect(stats.blockedByRobots).toEqual(["https://s.com/private/x"]);
  });

  it("stops at maxPages", async () => {
    const { pages } = await crawl({ startUrl: "https://s.com/", maxPages: 2, fetchOne, concurrency: 4 });
    expect(pages).toHaveLength(2);
  });

  it("can be cancelled", async () => {
    const ctrl = new AbortController();
    const { pages } = await crawl({
      startUrl: "https://s.com/", maxPages: 50, fetchOne, concurrency: 1, signal: ctrl.signal,
      onPage: () => ctrl.abort(),
    });
    expect(pages).toHaveLength(1);
  });

  it("records failed requests as errors instead of throwing", async () => {
    const { pages } = await crawl({ startUrl: "https://s.com/", maxPages: 5, fetchOne: async () => { throw new Error("boom"); } });
    expect(pages[0]).toMatchObject({ status: 0, error: "boom" });
  });
});
