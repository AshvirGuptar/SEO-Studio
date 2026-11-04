import { describe, expect, it } from "vitest";
import { auditSite, normalizeCrawlUrl, summarizeReport, type CrawledPage } from "./site-audit";
import { analyzePage } from "./analyze-page";

const page = (url: string, over: Partial<CrawledPage> = {}): CrawledPage => ({
  url, depth: 1, status: 200, redirects: 0, elapsedMs: 200, title: `Title ${url}`, metaDescription: `Meta ${url}`,
  h1Count: 1, wordCount: 600, canonical: url, noindex: false, score: 90, imagesMissingAlt: 0, internalLinks: [], ...over,
});
const ids = (r: ReturnType<typeof auditSite>) => Object.fromEntries(r.issues.map((i) => [i.id, i.items.map((x) => x.url)]));

describe("normalizeCrawlUrl", () => {
  it("drops hash, query and trailing slash; rejects assets", () => {
    expect(normalizeCrawlUrl("https://S.com/a/?x=1#top")).toBe("https://s.com/a");
    expect(normalizeCrawlUrl("https://s.com/")).toBe("https://s.com/");
    expect(normalizeCrawlUrl("https://s.com/a?x=1", { keepQuery: true })).toBe("https://s.com/a?x=1");
    expect(normalizeCrawlUrl("https://s.com/img/a.JPG")).toBeNull();
    expect(normalizeCrawlUrl("mailto:a@b.c")).toBeNull();
  });
});

describe("summarizeReport", () => {
  it("collects same-site followed links, normalized and de-duplicated", () => {
    const html = `<html><body><h1>x</h1><a href="/a">a</a><a href="/a/#x">a</a><a href="https://www.s.com/b">b</a>
      <a href="/c" rel="nofollow">c</a><a href="https://other.com">o</a><a href="/file.pdf">pdf</a></body></html>`;
    const p = summarizeReport(analyzePage(html, { url: "https://s.com/" }), { requestedUrl: "https://s.com/", status: 200, redirects: 0, elapsedMs: 10, depth: 0 });
    expect(p.internalLinks).toEqual(["https://s.com/a", "https://www.s.com/b"]);
    expect(p.externalLinks).toBe(1);
    expect(p.h1Count).toBe(1);
  });
});

describe("auditSite", () => {
  it("finds broken links, duplicates, thin pages and orphans", () => {
    const pages = [
      page("https://s.com/", { depth: 0, internalLinks: ["https://s.com/a", "https://s.com/b", "https://s.com/gone", "https://s.com/old"] }),
      page("https://s.com/a", { title: "Same", internalLinks: ["https://s.com/"] }),
      page("https://s.com/b", { title: "Same", wordCount: 40 }),
      page("https://s.com/gone", { status: 404 }),
      page("https://s.com/old", { redirects: 1, finalUrl: "https://s.com/new" }),
      page("https://s.com/lonely", { depth: -1 }),
      page("https://s.com/private", { noindex: true }),
    ];
    const r = auditSite(pages, { sitemapUrls: ["https://s.com/", "https://s.com/lonely"] });
    const i = ids(r);
    expect(i["broken-pages"]).toEqual(["https://s.com/gone"]);
    expect(i["broken-links"]).toEqual(["https://s.com/"]);
    expect(i["redirect-links"]).toEqual(["https://s.com/"]);
    expect(i["duplicate-titles"]).toEqual(["https://s.com/a", "https://s.com/b"]);
    expect(i["thin-content"]).toEqual(["https://s.com/b"]);
    expect(i["orphans"]).toContain("https://s.com/lonely");
    expect(i["noindex"]).toEqual(["https://s.com/private"]);
    expect(i["not-in-sitemap"]).toContain("https://s.com/a");
    expect(r.issues[0].severity).toBe("fail");
    expect(r.healthScore).toBeGreaterThan(0);
    expect(r.healthScore).toBeLessThan(100);
  });

  it("scores a clean site highly", () => {
    const r = auditSite([page("https://s.com/", { depth: 0, internalLinks: ["https://s.com/a"] }), page("https://s.com/a", { internalLinks: ["https://s.com/"] })]);
    expect(r.issues.filter((x) => x.severity !== "info")).toEqual([]);
    expect(r.healthScore).toBeGreaterThanOrEqual(90);
  });
});
