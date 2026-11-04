/** Single source of truth for tools shown in the sidebar and dashboard. */
export interface Tool {
  href: string;
  name: string;
  blurb: string;
  status: "live" | "soon";
  /** Only available when sign-in + database are configured. */
  needsAuth?: boolean;
  /** Short "use it to…" list for the homepage hover preview. */
  useCases?: string[];
  /** SEO, GEO or both, shown as tags on the homepage. */
  tags?: ("SEO" | "GEO")[];
}

export const TOOLS: Tool[] = [
  { href: "/analyzer", name: "Page Analyzer", blurb: "Audit any URL or HTML for on-page SEO and get a prioritized fix list.", status: "live", tags: ["SEO","GEO"], useCases: ["Audit a product or landing page before launch","See if AI crawlers can read and cite it","Hand a client a PDF of prioritized fixes"] },
  { href: "/content", name: "Content Optimizer", blurb: "Score titles, meta descriptions and product copy against a target keyword.", status: "live", tags: ["SEO"], useCases: ["Write titles that fit Google’s ~580px limit","Tune product descriptions to a keyword","Preview the result as a live search snippet"] },
  { href: "/urls", name: "URL Optimizer", blurb: "Check slugs and generate clean, keyword-rich URLs in bulk.", status: "live", tags: ["SEO"], useCases: ["Turn messy product URLs into clean slugs","Check 500 URLs at once before a migration","Export a 301 redirect map for your platform"] },
  { href: "/audit", name: "Site Audit", blurb: "Crawl a whole site for broken links, duplicates, thin content and orphan pages.", status: "live", tags: ["SEO","GEO"], useCases: ["Find broken links and 404s across the store","Spot duplicate titles, thin and orphan pages","Check which AI bots robots.txt blocks site-wide"] },
  { href: "/keywords", name: "Keyword Clusters", blurb: "Group keywords by topic and intent, map them to pages, find gaps and cannibalization.", status: "live", tags: ["SEO","GEO"], useCases: ["Group Search Console queries into page topics","Find topics you have no page for yet","Catch pages competing for the same searches"] },
  { href: "/ai-visibility", name: "AI Visibility", blurb: "Track whether ChatGPT, Perplexity, Gemini and Claude mention and cite your brand for the prompts that matter.", status: "soon", tags: ["GEO"], useCases: ["See if ChatGPT & Perplexity mention your brand","Track citations for your key buying questions","Compare your AI share of voice with competitors"] },
  { href: "/projects", name: "Projects & History", blurb: "Save audits per project, track scores over time and see what changed between runs.", status: "live", needsAuth: true, tags: ["SEO","GEO"], useCases: ["Track a client’s scores month over month","See exactly what improved between audits","Keep every saved report in one place"] },
];

/** Non-tool links shown below the tools in the sidebar. */
export const HELP_LINKS = [{ href: "/guide", name: "Guide" }];

/** A tool's effective status given whether sign-in is configured. */
export function toolStatus(t: Tool, authEnabled: boolean): Tool["status"] {
  return t.needsAuth && !authEnabled ? "soon" : t.status;
}
