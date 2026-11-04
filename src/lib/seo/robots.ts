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

/**
 * Rules for a specific crawler, following Google's/RFC 9309 group selection: the group whose
 * User-agent best (longest) matches the crawler's token; otherwise the "*" group.
 */
export function rulesForAgent(text: string, agent: string): Pick<RobotsRules, "allow" | "disallow"> {
  const groups: { agents: string[]; allow: string[]; disallow: string[] }[] = [];
  let current: (typeof groups)[number] | null = null;
  let inRules = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "user-agent") {
      if (!current || inRules) {
        current = { agents: [], allow: [], disallow: [] };
        groups.push(current);
        inRules = false;
      }
      current.agents.push(value.toLowerCase());
    } else if ((key === "allow" || key === "disallow") && current) {
      inRules = true;
      if (value) current[key].push(value);
    }
  }
  const a = agent.toLowerCase();
  // Longest User-agent token contained in the crawler's name wins; groups naming it are merged.
  let bestUa: string | null = null;
  for (const g of groups) for (const ua of g.agents) if (ua !== "*" && a.includes(ua) && ua.length > (bestUa?.length ?? 0)) bestUa = ua;
  const chosen = groups.filter((g) => g.agents.includes(bestUa ?? "*"));
  return { allow: chosen.flatMap((g) => g.allow), disallow: chosen.flatMap((g) => g.disallow) };
}

/** Is the site root (or a given path) crawlable by this agent? */
export function agentAllowed(text: string, agent: string, path = "/"): boolean {
  return isAllowed({ ...rulesForAgent(text, agent), sitemaps: [] }, path);
}
