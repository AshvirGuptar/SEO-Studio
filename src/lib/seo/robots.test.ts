import { describe, expect, it } from "vitest";
import { isAllowed, parseRobots, parseSitemap } from "./robots";

const ROBOTS = `
User-agent: Googlebot
Disallow: /google-only

User-agent: *
Disallow: /cart
Disallow: /search?
Disallow: /*.pdf$
Allow: /cart/help
# comment
Sitemap: https://s.com/sitemap.xml
`;

describe("robots.txt", () => {
  const rules = parseRobots(ROBOTS);
  it("keeps only * rules and sitemaps", () => {
    expect(rules.disallow).toEqual(["/cart", "/search?", "/*.pdf$"]);
    expect(rules.allow).toEqual(["/cart/help"]);
    expect(rules.sitemaps).toEqual(["https://s.com/sitemap.xml"]);
  });
  it("applies longest-match semantics and wildcards", () => {
    expect(isAllowed(rules, "/cart/checkout")).toBe(false);
    expect(isAllowed(rules, "/cart/help/returns")).toBe(true);
    expect(isAllowed(rules, "/search?q=x")).toBe(false);
    expect(isAllowed(rules, "/files/a.pdf")).toBe(false);
    expect(isAllowed(rules, "/files/a.pdf?x")).toBe(true);
    expect(isAllowed(rules, "/google-only")).toBe(true);
    expect(isAllowed(rules, "/products")).toBe(true);
  });
  it("treats an empty Disallow as allow-all", () => {
    expect(isAllowed(parseRobots("User-agent: *\nDisallow:"), "/anything")).toBe(true);
  });
});

describe("sitemap", () => {
  it("parses urlsets and indexes, including CDATA and entities", () => {
    expect(parseSitemap(`<urlset><url><loc>https://s.com/a?x=1&amp;y=2</loc></url><url><loc><![CDATA[https://s.com/b]]></loc></url></urlset>`))
      .toEqual({ isIndex: false, urls: ["https://s.com/a?x=1&y=2", "https://s.com/b"] });
    expect(parseSitemap(`<sitemapindex><sitemap><loc>https://s.com/s1.xml</loc></sitemap></sitemapindex>`).isIndex).toBe(true);
  });
});

describe("per-agent rules", () => {
  const txt = `User-agent: *\nDisallow: /cart\n\nUser-agent: GPTBot\nDisallow: /\n\nUser-agent: Google-Extended\nUser-agent: CCBot\nDisallow: /\n\nUser-agent: PerplexityBot\nAllow: /\n`;
  it("picks the most specific group, else *", async () => {
    const { agentAllowed } = await import("./robots");
    expect(agentAllowed(txt, "GPTBot")).toBe(false);
    expect(agentAllowed(txt, "CCBot")).toBe(false);
    expect(agentAllowed(txt, "Google-Extended")).toBe(false);
    expect(agentAllowed(txt, "PerplexityBot")).toBe(true);
    expect(agentAllowed(txt, "ClaudeBot")).toBe(true); // falls back to *, root allowed
    expect(agentAllowed(txt, "ClaudeBot", "/cart/x")).toBe(false);
    expect(agentAllowed("", "GPTBot")).toBe(true);
  });
});
