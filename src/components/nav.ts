/** Single source of truth for tools shown in the sidebar and dashboard. */
export interface Tool {
  href: string;
  name: string;
  blurb: string;
  status: "live" | "soon";
}

export const TOOLS: Tool[] = [
  { href: "/analyzer", name: "Page Analyzer", blurb: "Audit any URL or HTML for on-page SEO and get a prioritized fix list.", status: "live" },
  { href: "/content", name: "Content Optimizer", blurb: "Score titles, meta descriptions and product copy against a target keyword.", status: "live" },
  { href: "/urls", name: "URL Optimizer", blurb: "Check slugs and generate clean, keyword-rich URLs in bulk.", status: "live" },
  { href: "/audit", name: "Site Audit", blurb: "Crawl a whole site for broken links, duplicates, thin content and orphan pages.", status: "live" },
  { href: "/keywords", name: "Keyword Clusters", blurb: "Group keywords by topic and intent, map them to pages, find gaps and cannibalization.", status: "live" },
  { href: "/projects", name: "Projects & History", blurb: "Save audits per project and track scores over time. Needs a database (next up).", status: "soon" },
];

/** Non-tool links shown below the tools in the sidebar. */
export const HELP_LINKS = [{ href: "/guide", name: "Guide" }];
