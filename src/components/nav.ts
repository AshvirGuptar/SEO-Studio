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
  { href: "/keywords", name: "Keyword Clusters", blurb: "Group keywords by intent and map them to pages.", status: "soon" },
  { href: "/audit", name: "Site Audit", blurb: "Crawl a whole site for broken links, duplicates and missing tags.", status: "soon" },
  { href: "/projects", name: "Projects & History", blurb: "Save audits per project and track scores over time.", status: "soon" },
];
