import { describe, expect, it } from "vitest";
import { analyzeGeo, crawlerAccess } from "./geo";
import { extractFacts } from "./extract";
import { summarize } from "./score";

const GOOD = `<html><head><meta name="author" content="Jo Rivers">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[
 {"@type":"Article","datePublished":"2026-06-01","dateModified":"2026-10-01","author":{"@type":"Person","name":"Jo Rivers"}},
 {"@type":"Organization","name":"TrailCo","sameAs":["https://www.linkedin.com/company/trailco","https://en.wikipedia.org/wiki/TrailCo"]},
 {"@type":"FAQPage","mainEntity":[{"@type":"Question"},{"@type":"Question"}]}]}</script></head><body>
<h1>How to choose hiking boots</h1>
<p>Choose hiking boots by matching ankle support, waterproofing and fit to your terrain. Most day hikers do best with a mid-cut waterproof boot that weighs under 1.2 kg per pair.</p>
<h2>How should hiking boots fit?</h2>
<p>Hiking boots should leave about 1 cm of space in front of your toes, hold your heel firmly without slipping, and feel snug but not tight across the widest part of your foot when laced.</p>
<ul><li>Try them on in the afternoon</li><li>Wear hiking socks</li><li>Walk downhill on a ramp</li></ul>
<h2>Are waterproof boots worth it?</h2>
<p>Waterproof boots are worth it for wet climates, stream crossings and snow, but they run about 15% warmer, so breathable mesh boots are better for hot, dry trails in summer months.</p>
<table><tr><td>Weight</td><td>1.1 kg</td></tr></table>
<p>Sources: <a href="https://www.nps.gov/subjects/hikingclimbing/footwear.htm">NPS</a> and <a href="https://www.rei.com/learn">REI</a>. Prices start at $120.</p>
</body></html>`;

const NOW = new Date("2026-11-04");

describe("analyzeGeo", () => {
  it("rates an answer-ready, well-marked-up page highly", () => {
    const f = extractFacts(GOOD, "https://trailco.com/guides/boots");
    const { checks, crawlers } = analyzeGeo(f, { robotsTxt: "User-agent: GPTBot\nDisallow: /\n", llmsTxt: true, path: "/guides/boots", now: NOW });
    const byId = Object.fromEntries(checks.map((c) => [c.id, c.severity]));
    expect(byId["geo-ai-search-crawlers"]).toBe("pass"); // GPTBot is training-only
    expect(checks.find((c) => c.id === "geo-ai-training-crawlers")?.message).toContain("GPTBot");
    expect(byId["geo-question-headings"]).toBe("pass");
    expect(byId["geo-direct-answers"]).toBe("pass");
    expect(byId["geo-summary-lead"]).toBe("pass");
    expect(byId["geo-author"]).toBe("pass");
    expect(byId["geo-freshness"]).toBe("pass");
    expect(byId["geo-entity"]).toBe("pass");
    expect(byId["geo-faq-schema"]).toBe("pass");
    expect(byId["geo-llms-txt"]).toBe("pass");
    expect(crawlers?.find((c) => c.token === "GPTBot")?.allowed).toBe(false);
    expect(summarize(checks).score).toBeGreaterThanOrEqual(90);
  });

  it("flags blocked AI search bots, snippet limits and JS-only app shells", () => {
    const shell = `<html><head><meta name="robots" content="max-snippet:0"></head><body><div id="root"></div><script src="/a.js"></script></body></html>`;
    const { checks } = analyzeGeo(extractFacts(shell, "https://x.com/"), { robotsTxt: "User-agent: PerplexityBot\nDisallow: /\nUser-agent: OAI-SearchBot\nDisallow: /", now: NOW });
    const byId = Object.fromEntries(checks.map((c) => [c.id, c]));
    expect(byId["geo-ai-search-crawlers"].severity).toBe("fail");
    expect(byId["geo-ai-search-crawlers"].message).toContain("PerplexityBot");
    expect(byId["geo-snippet-controls"].severity).toBe("fail");
    expect(byId["geo-server-rendered"].severity).toBe("fail");
    expect(checks.filter((c) => c.severity === "fail").every((c) => c.fix)).toBe(true);
    expect(summarize(checks).score).toBeLessThan(40);
  });

  it("marks stale content and reports robots as unchecked for pasted HTML", () => {
    const old = `<html><head><meta property="article:modified_time" content="2023-01-01"></head><body><p>${"word ".repeat(40)}</p></body></html>`;
    const { checks, crawlers } = analyzeGeo(extractFacts(old), { now: NOW });
    expect(crawlers).toBeUndefined();
    expect(checks.find((c) => c.id === "geo-ai-search-crawlers")?.severity).toBe("info");
    expect(checks.find((c) => c.id === "geo-freshness")?.severity).toBe("warn");
  });
});

describe("crawlerAccess", () => {
  it("treats a missing robots.txt as everything allowed", () => {
    expect(crawlerAccess("").every((c) => c.allowed)).toBe(true);
  });
});
