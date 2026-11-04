/** robots.txt and sitemap.xml parsing (pure). */

export interface RobotsRules {
  allow: string[];
  disallow: string[];
  sitemaps: string[];
}

/** Parse robots.txt, keeping the rules that apply to all crawlers ("User-agent: *"). */
export function parseRobots(text: string): RobotsRules {
  const rules: RobotsRules = { allow: [], disallow: [], sitemaps: [] };
  let agents: string[] = [];
  let inRules = false; // true once a group's directives started (a new user-agent then starts a new group)
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "sitemap") {
      if (value) rules.sitemaps.push(value);
    } else if (key === "user-agent") {
      if (inRules) { agents = []; inRules = false; }
      agents.push(value.toLowerCase());
    } else if (key === "allow" || key === "disallow") {
      inRules = true;
      if (!agents.includes("*") || !value) continue;
      (key === "allow" ? rules.allow : rules.disallow).push(value);
    }
  }
  return rules;
}

function ruleToRegex(rule: string): RegExp {
  const anchored = rule.endsWith("$");
  const body = (anchored ? rule.slice(0, -1) : rule).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

/** Google semantics: the longest matching rule wins; ties go to Allow. */
export function isAllowed(rules: RobotsRules, pathAndQuery: string): boolean {
  let best: { len: number; allow: boolean } | null = null;
  for (const [list, allow] of [[rules.disallow, false], [rules.allow, true]] as const) {
    for (const r of list) {
      if (ruleToRegex(r).test(pathAndQuery) && (!best || r.length > best.len || (r.length === best.len && allow))) {
        best = { len: r.length, allow };
      }
    }
  }
  return best ? best.allow : true;
}

/** Extract <loc> URLs from a sitemap or sitemap index. */
export function parseSitemap(xml: string): { isIndex: boolean; urls: string[] } {
  const isIndex = /<sitemapindex[\s>]/i.test(xml);
  const urls = [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/loc>/gi)].map((m) =>
    m[1].replace(/&amp;/g, "&").trim(),
  );
  return { isIndex, urls };
}
