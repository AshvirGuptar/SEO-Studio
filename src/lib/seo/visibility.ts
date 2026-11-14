/**
 * AI Visibility engine: given what an AI assistant answered for a prompt (text + the sources it
 * cited), work out which tracked brands it mentioned, in what order, and whether it cited their
 * domains. Then roll results up into share of voice and a 0–100 visibility score.
 *
 * Pure: no React, no network, no SDK. The answers themselves come from src/lib/ai/visibility.ts.
 */
import { costMicros, DEFAULT_MODEL } from "../ai/pricing";

export interface TrackedBrand {
  name: string;
  /** Other spellings or product names that count as a mention ("EVGA", "Example-PC"). */
  aliases: string[];
  /** Domains that count as a citation of this brand (subdomains included). */
  domains: string[];
  /** The project's own brand (exactly one per project). */
  own: boolean;
}

export interface Source {
  url: string;
  title: string | null;
}

export interface PromptAnswer {
  answer: string;
  /** Sources the answer actually cites (inline citations). */
  citations: Source[];
  /** Every web search result the assistant looked at, cited or not. */
  sources: Source[];
}

export interface BrandHit {
  brand: string;
  own: boolean;
  mentioned: boolean;
  mentions: number;
  /** 1 = first tracked brand named in the answer. null when not mentioned. */
  rank: number | null;
  /** One of the brand's domains is cited in the answer. */
  cited: boolean;
  citedUrls: string[];
  /** One of the brand's domains showed up in the search results (even if not cited). */
  inSources: boolean;
}

export const LIMITS = {
  maxPrompts: 25,
  maxPromptLength: 300,
  maxCompetitors: 10,
  maxAliases: 10,
  maxDomains: 5,
} as const;

/** Visibility score = weighted mention rate + citation rate of the own brand, 0–100. */
export const SCORE_WEIGHTS = { mention: 0.6, citation: 0.4 } as const;

// ---------- parsing setup text ----------

/** One prompt per line; trims, drops blanks/duplicates, caps count and length. */
export function parsePrompts(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const p = raw.trim().replace(/\s+/g, " ").slice(0, LIMITS.maxPromptLength);
    const key = p.toLowerCase();
    if (!p || seen.has(key)) continue;
    seen.add(key);
    out.push(p);
    if (out.length >= LIMITS.maxPrompts) break;
  }
  return out;
}

/** "Name | domain.com, other.com | alias one, alias two" (domain and aliases optional). */
export function parseBrandLine(line: string, own = false): TrackedBrand | null {
  const [name = "", domains = "", aliases = ""] = line.split("|").map((s) => s.trim());
  if (!name) return null;
  return {
    name: name.slice(0, 80),
    domains: splitList(domains).map(normalizeDomain).filter((d): d is string => !!d).slice(0, LIMITS.maxDomains),
    aliases: splitList(aliases).filter((a) => a.toLowerCase() !== name.toLowerCase()).slice(0, LIMITS.maxAliases),
    own,
  };
}

export function parseCompetitors(text: string): TrackedBrand[] {
  const seen = new Set<string>();
  const out: TrackedBrand[] = [];
  for (const line of text.split(/\r?\n/)) {
    const b = parseBrandLine(line);
    if (!b || seen.has(b.name.toLowerCase())) continue;
    seen.add(b.name.toLowerCase());
    out.push(b);
    if (out.length >= LIMITS.maxCompetitors) break;
  }
  return out;
}

export function formatBrandLine(b: TrackedBrand): string {
  const parts = [b.name, b.domains.join(", "), b.aliases.join(", ")];
  while (parts.length > 1 && !parts[parts.length - 1]) parts.pop();
  return parts.join(" | ");
}

function splitList(s: string): string[] {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

export function normalizeDomain(d: string): string | null {
  const s = d.trim().toLowerCase();
  if (!s) return null;
  try {
    return new URL(/^https?:\/\//.test(s) ? s : `https://${s}`).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

// ---------- analyzing one answer ----------

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Matches a brand term as a whole word, case-insensitive. Spaces and hyphens inside the term are
 * interchangeable ("Example PC" matches "example-pc" and "ExamplePC").
 */
export function termRegex(term: string): RegExp {
  const body = term
    .trim()
    .split(/[\s-]+/)
    .map(escapeRegex)
    .join("[\\s-]?");
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, "giu");
}

/** Strip markdown links' URLs so a domain inside a link target doesn't count as a text mention. */
function visibleText(answer: string): string {
  return answer.replace(/\]\([^)]*\)/g, "]").replace(/https?:\/\/\S+/g, " ");
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function domainMatches(url: string, domains: string[]): boolean {
  const h = hostOf(url);
  return !!h && domains.some((d) => h === d || h.endsWith(`.${d}`));
}

export function analyzeAnswer(a: PromptAnswer, brands: TrackedBrand[]): BrandHit[] {
  const text = visibleText(a.answer);
  const found = brands.map((b) => {
    let mentions = 0;
    let first = Infinity;
    for (const term of [b.name, ...b.aliases]) {
      for (const m of text.matchAll(termRegex(term))) {
        mentions++;
        first = Math.min(first, m.index ?? Infinity);
      }
    }
    const citedUrls = [...new Set(a.citations.map((c) => c.url).filter((u) => domainMatches(u, b.domains)))];
    return {
      brand: b.name,
      own: b.own,
      mentions,
      first,
      citedUrls,
      inSources: a.sources.some((s) => domainMatches(s.url, b.domains)) || citedUrls.length > 0,
    };
  });
  const order = found.filter((f) => f.mentions > 0).sort((x, y) => x.first - y.first).map((f) => f.brand);
  return found.map((f) => ({
    brand: f.brand,
    own: f.own,
    mentioned: f.mentions > 0,
    mentions: f.mentions,
    rank: f.mentions > 0 ? order.indexOf(f.brand) + 1 : null,
    cited: f.citedUrls.length > 0,
    citedUrls: f.citedUrls,
    inSources: f.inSources,
  }));
}

// ---------- rolling up a run ----------

export interface BrandSummary {
  brand: string;
  own: boolean;
  /** Share of answered prompts that mention the brand, 0–1. */
  mentionRate: number;
  /** Share of answered prompts that cite one of the brand's domains, 0–1. */
  citationRate: number;
  /** Average rank among tracked brands when mentioned. */
  avgRank: number | null;
  /** The brand's share of all tracked-brand mentions, 0–1. */
  shareOfVoice: number;
  /** The brand's share of all tracked-brand citations, 0–1. */
  citationShare: number;
  promptsMentioned: number;
  promptsCited: number;
}

export interface RunSummary {
  answered: number;
  brands: BrandSummary[];
  own: BrandSummary | null;
  /** 0–100, from the own brand's mention and citation rates. null when nothing was answered. */
  score: number | null;
}

export function summarizeRun(results: { hits: BrandHit[] }[], brands: TrackedBrand[]): RunSummary {
  const answered = results.length;
  const totalMentions = sum(results.flatMap((r) => r.hits.map((h) => h.mentions)));
  const totalCited = sum(results.flatMap((r) => r.hits.map((h) => (h.cited ? 1 : 0))));
  const summaries: BrandSummary[] = brands.map((b) => {
    const hits = results.map((r) => r.hits.find((h) => h.brand === b.name)).filter((h): h is BrandHit => !!h);
    const mentioned = hits.filter((h) => h.mentioned);
    const cited = hits.filter((h) => h.cited);
    const ranks = mentioned.map((h) => h.rank ?? 0).filter(Boolean);
    return {
      brand: b.name,
      own: b.own,
      mentionRate: answered ? mentioned.length / answered : 0,
      citationRate: answered ? cited.length / answered : 0,
      avgRank: ranks.length ? round1(sum(ranks) / ranks.length) : null,
      shareOfVoice: totalMentions ? sum(hits.map((h) => h.mentions)) / totalMentions : 0,
      citationShare: totalCited ? cited.length / totalCited : 0,
      promptsMentioned: mentioned.length,
      promptsCited: cited.length,
    };
  });
  const own = summaries.find((s) => s.own) ?? null;
  return {
    answered,
    brands: summaries,
    own,
    score: own && answered ? visibilityScore(own) : null,
  };
}

export function visibilityScore(s: Pick<BrandSummary, "mentionRate" | "citationRate">): number {
  return Math.round(100 * (SCORE_WEIGHTS.mention * s.mentionRate + SCORE_WEIGHTS.citation * s.citationRate));
}

// ---------- cost estimate ----------

/**
 * Rough per-prompt usage for one web-search answer, low and high. Search results come back as
 * input tokens, so input dominates. Measured runs replace this with real usage.
 */
export const PROMPT_USAGE_ESTIMATE = {
  low: { inputTokens: 6_000, outputTokens: 800, webSearches: 1 },
  /** High case per search used: each search adds roughly 3k input tokens of results. */
  high: { baseInputTokens: 5_000, inputTokensPerSearch: 3_000, outputTokens: 2_000 },
} as const;

/** Low/high cost of a run. `maxSearches` is the per-question web search cap (AI_WEB_SEARCH_MAX_USES). */
export function estimateRunCost(promptCount: number, model = DEFAULT_MODEL, maxSearches = 2): { lowMicros: number; highMicros: number } {
  const h = PROMPT_USAGE_ESTIMATE.high;
  const high = { inputTokens: h.baseInputTokens + h.inputTokensPerSearch * maxSearches, outputTokens: h.outputTokens, webSearches: maxSearches };
  const low = { ...PROMPT_USAGE_ESTIMATE.low, webSearches: Math.min(PROMPT_USAGE_ESTIMATE.low.webSearches, maxSearches) };
  return {
    lowMicros: promptCount * costMicros(model, low),
    highMicros: promptCount * costMicros(model, high),
  };
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
