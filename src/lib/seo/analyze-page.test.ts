import { describe, expect, it } from "vitest";
import { analyzePage } from "./analyze-page";
import { analyzeBodyCopy, analyzeTitle, analyzeMetaDescription } from "./copy";

const GOOD = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Running Shoes for Beginners: 2026 Buying Guide</title>
<meta name="description" content="Shop the best running shoes for beginners. Learn how to pick the right fit, cushioning and support with our complete guide and expert picks.">
<link rel="canonical" href="https://example.com/running-shoes">
<link rel="icon" href="/favicon.ico">
<meta property="og:title" content="Running Shoes"><meta property="og:description" content="Guide"><meta property="og:image" content="/og.png">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Article"},{"@type":"BreadcrumbList"}]}</script>
</head><body>
<h1>Running Shoes for Beginners</h1>
<p>${"Running shoes help you run comfortably and safely. Pick a pair that fits well. ".repeat(25)}</p>
<h2>Fit</h2><p>Try them on late in the day.</p>
<img src="a.jpg" alt="Blue running shoes"><img src="b.jpg" alt="">
<a href="/a">Trail shoes</a><a href="/b">Road shoes</a><a href="/c">Sizing guide</a><a href="https://other.com" rel="nofollow">Study</a>
</body></html>`;

describe("analyzePage", () => {
  it("scores a well-optimized page highly", () => {
    const r = analyzePage(GOOD, { url: "https://example.com/running-shoes", keyword: "running shoes" });
    expect(r.summary.score).toBeGreaterThanOrEqual(85);
    expect(r.checks.find((c) => c.id === "h1-count")?.severity).toBe("pass");
    expect(r.facts.jsonLdTypes).toEqual(["Article", "BreadcrumbList"]);
    expect(r.facts.links.filter((l) => l.internal)).toHaveLength(3);
  });

  it("scores a bare page poorly and explains why", () => {
    const r = analyzePage("<html><head><meta name='robots' content='noindex'></head><body><p>hi</p></body></html>", { keyword: "shoes" });
    expect(r.summary.score).toBeLessThan(40);
    const ids = r.checks.filter((c) => c.severity === "fail").map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(["title-missing", "meta-missing", "h1-count", "indexable", "viewport"]));
    expect(r.checks.filter((c) => c.severity === "fail").every((c) => c.fix)).toBe(true);
  });
});

describe("copy analyzers", () => {
  it("warns on long titles and late keywords", () => {
    const checks = analyzeTitle("Our Amazing Store Has Everything You Could Want Including Running Shoes", "running shoes");
    expect(checks.find((c) => c.id === "title-length")?.severity).toBe("warn");
    expect(checks.find((c) => c.id === "title-keyword")?.severity).toBe("warn");
  });
  it("fails obvious keyword stuffing", () => {
    const checks = analyzeBodyCopy("boots boots boots buy boots now", "boots");
    expect(checks.find((c) => c.id === "keyword-density")?.severity).toBe("fail");
  });
  it("fails a missing meta description", () => {
    expect(analyzeMetaDescription("")[0].severity).toBe("fail");
  });
});
