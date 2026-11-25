import { describe, expect, it } from "vitest";
import { AI_SECTION_START, buildAiRobots, buildLlmsTxt, defaultPolicy, parseCsv, parsePageList, sectionFor, stripAiGroups, verifyAiRobots } from "./ai-access";
import { agentAllowed } from "./robots";
import { toCsv } from "../csv";

describe("AI robots.txt builder", () => {
  it("allows search bots and blocks training bots when asked, and verifies with the shared matcher", () => {
    const policy = defaultPolicy(true);
    const txt = buildAiRobots({ policy, sitemapUrl: "https://example.com/sitemap.xml" });
    expect(txt).toContain("User-agent: OAI-SearchBot\nAllow: /");
    expect(txt).toContain("User-agent: GPTBot\nDisallow: /");
    expect(txt).toContain("Sitemap: https://example.com/sitemap.xml");
    const { checks, crawlers } = verifyAiRobots(txt, policy);
    expect(checks.find((c) => c.id === "ai-kit-matches-policy")?.severity).toBe("pass");
    expect(crawlers.find((c) => c.token === "ClaudeBot")?.allowed).toBe(false);
    expect(crawlers.find((c) => c.token === "Claude-SearchBot")?.allowed).toBe(true);
  });

  it("merges into an existing robots.txt, replacing old AI groups and keeping everything else", () => {
    const existing = "User-agent: *\nDisallow: /cart\n\nUser-agent: GPTBot\nUser-agent: SomeOtherBot\nDisallow: /\n\nUser-agent: PerplexityBot\nDisallow: /\n\nSitemap: https://example.com/sitemap.xml";
    const stripped = stripAiGroups(existing);
    expect(stripped).not.toMatch(/GPTBot|PerplexityBot/);
    expect(stripped).toContain("User-agent: SomeOtherBot\nDisallow: /");
    const policy = defaultPolicy(false);
    const txt = buildAiRobots({ policy, existing, sitemapUrl: "https://example.com/sitemap.xml" });
    expect(txt.match(/Sitemap:/g)).toHaveLength(1);
    expect(agentAllowed(txt, "PerplexityBot")).toBe(true);
    expect(agentAllowed(txt, "SomeOtherBot")).toBe(false);
    expect(agentAllowed(txt, "Googlebot", "/cart")).toBe(false);
    expect(verifyAiRobots(txt, policy).checks[0].severity).toBe("pass");
  });

  it("replaces its own earlier section when run again", () => {
    const once = buildAiRobots({ policy: defaultPolicy(false) });
    const twice = buildAiRobots({ policy: defaultPolicy(true), existing: once });
    expect(twice.split(AI_SECTION_START)).toHaveLength(2);
    expect(agentAllowed(twice, "GPTBot")).toBe(false);
  });

  it("warns when a search bot is blocked", () => {
    const policy = { ...defaultPolicy(false), "OAI-SearchBot": false };
    expect(verifyAiRobots(buildAiRobots({ policy }), policy).checks.find((c) => c.id === "geo-ai-search-crawlers")?.severity).toBe("warn");
  });
});

describe("llms.txt", () => {
  it("groups pages by section with Main first and policies under Optional", () => {
    const txt = buildLlmsTxt({
      siteName: "Example PC", summary: "PC parts store.\nShips in the US.", pages: [
        { url: "https://example.com/policies/returns", title: "Returns" },
        { url: "https://example.com/products/aurora", title: "Aurora 12GB", description: "1440p card" },
        { url: "https://example.com/", title: "Home" },
        { url: "https://example.com/products/aurora", title: "dupe" },
      ],
    });
    expect(txt).toBe("# Example PC\n\n> PC parts store. Ships in the US.\n\n## Main\n\n- [Home](https://example.com/)\n\n## Products\n\n- [Aurora 12GB](https://example.com/products/aurora): 1440p card\n\n## Optional\n\n- [Returns](https://example.com/policies/returns)\n");
  });

  it("names sections from the first path segment", () => {
    expect(sectionFor("https://x.com/blog/a")).toBe("Blog");
    expect(sectionFor("https://x.com/gift-cards")).toBe("Gift Cards");
    expect(sectionFor("https://x.com/")).toBe("Main");
  });

  it("reads a Site Audit CSV export, keeping indexable 200 pages", () => {
    const csv = toCsv([
      ["url", "status", "seo_score", "geo_score", "title", "meta_description", "words", "h1_count", "depth", "response_ms", "redirects", "noindex", "canonical", "error"],
      ["https://x.com/", 200, 90, 80, "Home, \"best\" store", "We sell parts", 300, 1, 0, 120, 0, "", "", ""],
      ["https://x.com/old", 404, "", "", "", "", "", "", 1, 50, 0, "", "", ""],
      ["https://x.com/cart", 200, 50, 40, "Cart", "", 20, 1, 1, 80, 0, "yes", "", ""],
    ]);
    expect(parsePageList(csv)).toEqual([{ url: "https://x.com/", title: "Home, \"best\" store", description: "We sell parts" }]);
  });

  it("reads plain URL | Title | Description lines", () => {
    expect(parsePageList("https://x.com/a | A page | About A\nnot a url\nhttps://x.com/b")).toEqual([
      { url: "https://x.com/a", title: "A page", description: "About A" }, { url: "https://x.com/b", title: "", description: "" },
    ]);
  });

  it("parses quoted CSV with embedded newlines", () => {
    expect(parseCsv('a,"b\nc","d""e"\r\n1,2,3')).toEqual([["a", "b\nc", 'd"e'], ["1", "2", "3"]]);
  });
});
