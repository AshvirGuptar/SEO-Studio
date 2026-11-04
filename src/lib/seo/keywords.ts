/**
 * Keyword clustering + intent classification + keyword-to-page mapping.
 * Rule-based (no external data): groups keywords that share meaningful terms,
 * so one cluster ≈ one page you should rank with.
 */
import { STOP_WORDS, words } from "./text";
import { pathOf, slugify } from "./slug";

export type Intent = "transactional" | "commercial" | "informational" | "navigational";

export interface KeywordInput {
  keyword: string;
  volume?: number;
}

export interface Cluster {
  id: number;
  name: string; // primary keyword (highest volume / most central)
  intent: Intent;
  keywords: (KeywordInput & { intent: Intent })[];
  totalVolume: number;
  page?: string; // mapped page URL, if any
  pageScore?: number; // 0-1 overlap with mapped page
  suggestedSlug: string;
}

export interface MappingResult {
  clusters: Cluster[];
  /** Pages that best-match more than one cluster: possible keyword cannibalization. */
  cannibalized: { page: string; clusters: string[] }[];
  /** Clusters fully targeted by more than one page: those pages compete with each other. */
  competing: { cluster: string; pages: string[] }[];
  /** Clusters with no matching page: content gaps. */
  gaps: string[];
}

const INTENT_RULES: [Intent, RegExp][] = [
  ["transactional", /\b(buy|price|prices|pricing|cheap|cheapest|deal|deals|discount|coupon|promo|sale|order|shop|shopping|for sale|near me|delivery|shipping|cost|purchase|subscription)\b/],
  ["commercial", /\b(best|top|review|reviews|vs|versus|compare|comparison|alternative|alternatives|rated|recommended|brands)\b/],
  ["navigational", /\b(login|log in|sign in|website|official|account|contact|customer service|app|download)\b/],
  ["informational", /\b(how|what|why|when|where|who|which|guide|tips|ideas|tutorial|learn|meaning|definition|examples|is|are|can|does|do|should)\b/],
];

/** Classify search intent from modifier words. Product-type queries default to commercial. */
export function classifyIntent(keyword: string): Intent {
  const k = keyword.toLowerCase();
  for (const [intent, re] of INTENT_RULES) if (re.test(k)) return intent;
  return "commercial";
}

/** Very light stemmer: enough to treat "boots"/"boot", "running"/"run" as the same term. */
export function stem(w: string): string {
  if (w.length <= 3) return w;
  if (w.endsWith("ies") && w.length > 4) return w.slice(0, -3) + "y";
  if (w.endsWith("ing") && w.length > 5) {
    const s = w.slice(0, -3);
    return /(.)\1$/.test(s) ? s.slice(0, -1) : s; // running -> run
  }
  if (w.endsWith("es") && /(sses|shes|ches|xes|zes)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us")) return w.slice(0, -1);
  return w;
}

const MODIFIERS = new Set(
  ("buy price prices cheap cheapest best top review reviews vs versus compare how what why when where who which " +
    "guide tips ideas near me online sale deal deals discount for shop new 2024 2025 2026 2027 good great").split(" "),
);

/** Meaningful stemmed terms of a keyword (no stop words or intent modifiers). */
export function coreTerms(keyword: string): Set<string> {
  const ws = words(keyword).filter((w) => !STOP_WORDS.has(w) && !MODIFIERS.has(w));
  const terms = ws.length > 0 ? ws : words(keyword);
  return new Set(terms.map(stem));
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Parse pasted text or CSV: "keyword" or "keyword,volume" or "keyword<TAB>volume" per line. */
export function parseKeywords(text: string): KeywordInput[] {
  const seen = new Set<string>();
  const out: KeywordInput[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || /^"?(keyword|keywords|query|queries|search term|search terms)"?\s*([,\t;]|$)/i.test(line)) continue; // blank / header row
    const m = line.match(/^"?(.+?)"?\s*[,\t;]\s*"?([\d,. ]+)"?\s*$/);
    const keyword = (m ? m[1] : line).trim().toLowerCase().replace(/\s+/g, " ");
    if (!keyword) continue;
    if (seen.has(keyword)) continue;
    seen.add(keyword);
    const volume = m ? Number(m[2].replace(/[ ,]/g, "")) : undefined;
    out.push({ keyword, volume: Number.isFinite(volume) ? volume : undefined });
  }
  return out;
}

/**
 * Greedy clustering: strongest keywords become seeds; others join the seed they overlap most with
 * (Jaccard on core terms ≥ threshold). Higher threshold = tighter, more numerous clusters.
 */
export function clusterKeywords(items: KeywordInput[], threshold = 0.5): Cluster[] {
  const enriched = items.map((k) => ({ ...k, intent: classifyIntent(k.keyword), terms: coreTerms(k.keyword) }));
  // Seeds: highest volume first, then shorter (head terms) first.
  const order = [...enriched].sort(
    (a, b) => (b.volume ?? 0) - (a.volume ?? 0) || a.terms.size - b.terms.size || a.keyword.localeCompare(b.keyword),
  );

  const groups: { seed: (typeof enriched)[number]; members: (typeof enriched)[number][] }[] = [];
  for (const k of order) {
    let best: (typeof groups)[number] | null = null;
    let bestSim = 0;
    for (const g of groups) {
      // Informational queries (how/what/guide) need a different page type than product/buying
      // queries, so never merge across that line even when the words overlap.
      if ((k.intent === "informational") !== (g.seed.intent === "informational")) continue;
      const sim = jaccard(k.terms, g.seed.terms);
      if (sim > bestSim) { bestSim = sim; best = g; }
    }
    if (best && bestSim >= threshold) best.members.push(k);
    else groups.push({ seed: k, members: [k] });
  }

  return groups
    .map((g, i) => {
      const counts = new Map<Intent, number>();
      for (const m of g.members) counts.set(m.intent, (counts.get(m.intent) ?? 0) + (m.volume ?? 1));
      const intent = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
      return {
        id: i,
        name: g.seed.keyword,
        intent,
        keywords: g.members.map(({ keyword, volume, intent }) => ({ keyword, volume, intent })),
        totalVolume: g.members.reduce((n, m) => n + (m.volume ?? 0), 0),
        suggestedSlug: slugify(g.seed.keyword),
      };
    })
    .sort((a, b) => b.totalVolume - a.totalVolume || b.keywords.length - a.keywords.length)
    .map((c, i) => ({ ...c, id: i }));
}

/**
 * Map clusters to existing pages. Pages are given as URLs, optionally "URL | Page title" per line.
 * A page matches a cluster by term overlap with its URL path + title.
 */
/** URL/title signals that a page is editorial content (blog post, guide) rather than a product/category. */
const CONTENT_PAGE = /\b(blog|blogs|guide|guides|how|tips|learn|article|articles|news|journal|resources|faq|help)\b/i;

export function mapClustersToPages(clusters: Cluster[], pagesText: string): MappingResult {
  const pages = pagesText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [url, title = ""] = l.split(/\s*\|\s*/);
      const pathWords = pathOf(url).replace(/[-_/.]+/g, " ");
      return { url, terms: coreTerms(`${pathWords} ${title}`), isContent: CONTENT_PAGE.test(`${pathWords} ${title}`) };
    });

  // How many clusters use each term: generic words ("hiking") appear in many, distinctive ones ("clean") in few.
  const df = new Map<string, number>();
  for (const c of clusters) for (const t of coreTerms(c.name)) df.set(t, (df.get(t) ?? 0) + 1);

  const byPage = new Map<string, string[]>();
  const competing: MappingResult["competing"] = [];
  const mapped = clusters.map((c) => {
    const terms = coreTerms(c.name);
    const minDf = Math.min(...[...terms].map((t) => df.get(t) ?? 0));
    const distinctive = [...terms].filter((t) => (df.get(t) ?? 0) === minDf);
    // A page must cover most of the cluster's terms: all of them for 1–2 term clusters, 2 of 3, 3 of 4…
    // (sharing one generic word like "hiking" is not a match).
    const needed = terms.size <= 2 ? terms.size : Math.ceil((terms.size * 2) / 3 - 1e-9);
    let best: { url: string; coverage: number; specificity: number } | null = null;
    const fullMatches: string[] = [];
    for (const p of pages) {
      // How-to topics belong on blog/guide pages; product topics on product/category pages.
      if ((c.intent === "informational") !== p.isContent) continue;
      let inter = 0;
      for (const t of terms) if (p.terms.has(t)) inter++;
      if (inter === 0 || inter < needed) continue;
      // The page must cover what makes this cluster different, not just the shared generic words.
      if (!distinctive.some((t) => p.terms.has(t))) continue;
      const coverage = inter / terms.size;
      if (coverage === 1) fullMatches.push(p.url);
      const specificity = inter / (terms.size + p.terms.size - inter); // Jaccard: prefers focused pages
      if (!best || coverage > best.coverage || (coverage === best.coverage && specificity > best.specificity)) {
        best = { url: p.url, coverage, specificity };
      }
    }
    if (fullMatches.length > 1) competing.push({ cluster: c.name, pages: fullMatches });
    if (best) {
      byPage.set(best.url, [...(byPage.get(best.url) ?? []), c.name]);
      return { ...c, page: best.url, pageScore: Math.round(best.coverage * 100) / 100 };
    }
    return { ...c, page: undefined, pageScore: undefined };
  });

  return {
    clusters: mapped,
    cannibalized: [...byPage.entries()].filter(([, cs]) => cs.length > 1).map(([page, cs]) => ({ page, clusters: cs })),
    competing,
    gaps: pages.length ? mapped.filter((c) => !c.page).map((c) => c.name) : [],
  };
}
