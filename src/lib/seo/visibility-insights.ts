/**
 * Read-outs for an AI Visibility run on top of the core engine (visibility.ts): which websites the
 * AI leans on, questions where competitors show up and you don't, change since the last run, and a
 * one-line summary. Pure: no React, no network.
 */
import { domainMatches, normalizeDomain, type BrandHit, type RunSummary, type Source, type TrackedBrand } from "./visibility";

export interface CitedSource {
  domain: string;
  /** Answers (prompts) that cited this site at least once. */
  answers: number;
  /** The tracked brand that owns this domain, if any. */
  brand: string | null;
  own: boolean;
}

/** Sites cited across the run's answers, most-cited first (each answer counts a site once). */
export function topCitedSources(results: { citations: Source[] }[], brands: TrackedBrand[], limit = 8): CitedSource[] {
  const counts = new Map<string, number>();
  for (const r of results) {
    const seen = new Set<string>();
    for (const c of r.citations) {
      const d = normalizeDomain(c.url);
      if (d && !seen.has(d)) {
        seen.add(d);
        counts.set(d, (counts.get(d) ?? 0) + 1);
      }
    }
  }
  return [...counts.entries()]
    .map(([domain, answers]) => {
      const b = brands.find((x) => domainMatches(`https://${domain}`, x.domains));
      return { domain, answers, brand: b?.name ?? null, own: b?.own ?? false };
    })
    .sort((a, b) => b.answers - a.answers || a.domain.localeCompare(b.domain))
    .slice(0, limit);
}

export interface Gap {
  prompt: string;
  /** Competitors named in that answer, in the order the AI named them. */
  competitors: string[];
}

/** Questions where at least one competitor is named but your brand isn't: the clearest openings. */
export function visibilityGaps(results: { prompt: string; hits: BrandHit[] }[]): Gap[] {
  return results
    .filter((r) => r.hits.some((h) => h.own && !h.mentioned) && r.hits.some((h) => !h.own && h.mentioned))
    .map((r) => ({
      prompt: r.prompt,
      competitors: r.hits.filter((h) => !h.own && h.mentioned).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)).map((h) => h.brand),
    }))
    .sort((a, b) => b.competitors.length - a.competitors.length);
}

/** Score change vs. the previous finished run (null when there's nothing to compare). */
export function scoreDelta(current: number | null, previous: number | null | undefined): number | null {
  return current === null || previous === null || previous === undefined ? null : current - previous;
}

/** Plain-English one-liner for the top of the report. */
export function runHeadline(s: RunSummary): string {
  if (!s.own || s.answered === 0) return "No answers yet.";
  const leader = [...s.brands].sort((a, b) => b.shareOfVoice - a.shareOfVoice)[0];
  const you = `${s.own.brand} was named in ${s.own.promptsMentioned} of ${s.answered} answers and its site was cited in ${s.own.promptsCited}.`;
  if (!leader || leader.shareOfVoice === 0) return `${you} No tracked brand was named.`;
  if (leader.own) return `${you} You lead share of voice at ${Math.round(leader.shareOfVoice * 100)}%.`;
  return `${you} ${leader.brand} leads share of voice at ${Math.round(leader.shareOfVoice * 100)}%.`;
}
