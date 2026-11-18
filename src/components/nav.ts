/** Single source of truth for tools shown in the sidebar and dashboard. */
export interface Tool {
  href: string;
  name: string;
  blurb: string;
  status: "live" | "soon";
  /** Needs saved data: a database (with sign-in, or in open mode). */
  needsAuth?: boolean;
  /**
   * Premium: uses the Claude API (costs money), so it needs an approved account. Shown with a gold
   * crown; signed-out visitors see a sign-in prompt instead of the tool.
   */
  premium?: boolean;
  /** Short "use it to…" list for the homepage hover preview. */
  useCases?: string[];
  /** SEO, GEO or both, shown as tags on the homepage. */
  tags?: ("SEO" | "GEO")[];
}

export const TOOLS: Tool[] = [
  { href: "/analyzer", name: "Page Analyzer", blurb: "Audit any URL or HTML for on-page SEO and get a prioritized fix list.", status: "live", tags: ["SEO","GEO"], useCases: ["Audit a product or landing page before launch","See if AI crawlers can read and cite it","Hand a client a PDF of prioritized fixes"] },
  { href: "/content", name: "Content Optimizer", blurb: "Score titles, meta descriptions and product copy against a target keyword.", status: "live", tags: ["SEO","GEO"], useCases: ["Write titles that fit Google’s ~580px limit","Tune product descriptions to a keyword","Preview the result as a live search snippet"] },
  { href: "/urls", name: "URL Optimizer", blurb: "Check slugs and generate clean, keyword-rich URLs in bulk.", status: "live", tags: ["SEO"], useCases: ["Turn messy product URLs into clean slugs","Check 500 URLs at once before a migration","Export a 301 redirect map for your platform"] },
  { href: "/audit", name: "Site Audit", blurb: "Crawl a whole site for broken links, duplicates, thin content and orphan pages.", status: "live", tags: ["SEO","GEO"], useCases: ["Find broken links and 404s across the store","Spot duplicate titles, thin and orphan pages","Check which AI bots robots.txt blocks site-wide"] },
  { href: "/keywords", name: "Keyword Clusters", blurb: "Group keywords by topic and intent, map them to pages, find gaps and cannibalization.", status: "live", tags: ["SEO","GEO"], useCases: ["Group Search Console queries into page topics","Find topics you have no page for yet","Catch pages competing for the same searches"] },
  { href: "/geo-optimization", name: "GEO Optimization", premium: true, blurb: "Fix what the GEO score flags: answer-first rewrites, FAQ and schema markup, llms.txt and AI-crawler rules, each re-scored before you publish.", status: "soon", tags: ["GEO"], useCases: ["Rewrite a page answer-first so AI can quote it", "Generate FAQ + schema markup from your copy", "Build llms.txt and AI-crawler robots.txt rules"] },
  { href: "/ai-visibility", name: "AI Visibility", premium: true, blurb: "Ask an AI assistant with web search the questions your customers ask, and track whether it mentions and cites your brand.", status: "live", needsAuth: true, tags: ["GEO"], useCases: ["See if AI answers mention your brand","Track citations for your key buying questions","Compare your AI share of voice with competitors"] },
  { href: "/projects", name: "Projects & History", blurb: "Save audits per project, track scores over time and see what changed between runs.", status: "live", needsAuth: true, tags: ["SEO","GEO"], useCases: ["Track a client’s scores month over month","See exactly what improved between audits","Keep every saved report in one place"] },
];

/** Non-tool links shown below the tools in the sidebar. */
export const HELP_LINKS = [{ href: "/guide", name: "Guide" }];

/** A tool's effective status given whether saved data is available. */
export function toolStatus(t: Tool, dataEnabled: boolean): Tool["status"] {
  return t.needsAuth && !dataEnabled ? "soon" : t.status;
}
