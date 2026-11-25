/**
 * Fact-preservation check for AI rewrites (pure). A rewrite may change wording, but never facts:
 * - "no-invent" (titles, metas): every number/price and marketing claim in the rewrite must already
 *   be in the source. Short copy can't hold every fact, so leaving some out is fine.
 * - "preserve" (descriptions): additionally, every number/price in the source must survive, and any
 *   explicitly listed facts must appear verbatim.
 */

/** Claims that change what a product promises; a rewrite must not add them if the source lacks them. */
export const CLAIM_PATTERNS: { label: string; re: RegExp }[] = [
  { label: "free shipping", re: /\bfree (?:shipping|delivery)\b/i },
  { label: "guarantee", re: /\bguarantee[ds]?\b/i },
  { label: "warranty", re: /\bwarrant(?:y|ies|ied)\b/i },
  { label: "money-back", re: /\bmoney[- ]back\b/i },
  { label: "certified", re: /\bcertifi(?:ed|cation)\b/i },
  { label: "award-winning", re: /\baward[- ]winning\b/i },
  { label: "#1 / number one", re: /(?:#\s?1\b|\bnumber one\b|\bno\.\s?1\b)/i },
  { label: "best-selling", re: /\bbest[- ]sell(?:ing|er)\b/i },
  { label: "lifetime", re: /\blifetime\b/i },
  { label: "clinically proven", re: /\bclinically (?:proven|tested)\b/i },
  { label: "waterproof", re: /\bwaterproof\b/i },
  { label: "organic", re: /\borganic\b/i },
  { label: "eco-friendly", re: /\beco[- ]friendly\b|\bsustainabl[ey]\b/i },
  { label: "patented", re: /\bpatent(?:ed)?\b/i },
  { label: "sale / discount", re: /\b(?:on sale|discount(?:ed)?|\d+% off)\b/i },
];

/**
 * Numbers in text, normalized ("2,610" → "2610", "$549.00" → "$549"). Prices keep their currency
 * sign so "$129" and "129" count as different facts. Years and 1-digit counts are included too,
 * because a changed "3-year warranty" is a changed fact.
 */
export function extractNumbers(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/([$€£])?\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?/g)) {
    const whole = m[2].replace(/,/g, "");
    const frac = m[3] && !/^0+$/.test(m[3]) ? `.${m[3].replace(/0+$/, "")}` : "";
    out.add(`${m[1] ?? ""}${whole}${frac}`);
  }
  return [...out];
}

export function extractClaims(text: string): string[] {
  return CLAIM_PATTERNS.filter((c) => c.re.test(text)).map((c) => c.label);
}

export interface FactCheck {
  ok: boolean;
  /** Numbers/prices in the rewrite that aren't in the source. */
  inventedNumbers: string[];
  /** Claims in the rewrite that the source doesn't make. */
  inventedClaims: string[];
  /** "preserve" mode: source numbers missing from the rewrite. */
  droppedNumbers: string[];
  /** "preserve" mode: required facts not found verbatim. */
  missingFacts: string[];
}

/**
 * `source` = everything the rewrite may draw facts from. `preserveFrom` (preserve mode) = the text whose
 * numbers must all survive; defaults to `source` (e.g. a description rewrite keeps the description's
 * numbers but needn't repeat every spec from the separate specs table).
 */
export function checkFacts(source: string, rewrite: string, opts: { mode: "no-invent" | "preserve"; requiredFacts?: string[]; preserveFrom?: string }): FactCheck {
  const srcNums = new Set(extractNumbers(source));
  const outNums = new Set(extractNumbers(rewrite));
  const srcClaims = new Set(extractClaims(source));
  const inventedNumbers = [...outNums].filter((n) => !srcNums.has(n));
  const inventedClaims = extractClaims(rewrite).filter((c) => !srcClaims.has(c));
  const keep = opts.preserveFrom === undefined ? srcNums : new Set(extractNumbers(opts.preserveFrom));
  const droppedNumbers = opts.mode === "preserve" ? [...keep].filter((n) => !outNums.has(n)) : [];
  const missingFacts = opts.mode === "preserve" ? (opts.requiredFacts ?? []).filter((f) => !rewrite.includes(f)) : [];
  return {
    ok: !inventedNumbers.length && !inventedClaims.length && !droppedNumbers.length && !missingFacts.length,
    inventedNumbers, inventedClaims, droppedNumbers, missingFacts,
  };
}

/** One-line explanation for the UI ("Adds a price not in the original: $499"). */
export function describeFactCheck(c: FactCheck): string {
  if (c.ok) return "All facts kept.";
  const parts: string[] = [];
  if (c.inventedNumbers.length) parts.push(`adds numbers not in the original (${c.inventedNumbers.join(", ")})`);
  if (c.inventedClaims.length) parts.push(`adds claims (${c.inventedClaims.join(", ")})`);
  if (c.droppedNumbers.length) parts.push(`drops numbers (${c.droppedNumbers.join(", ")})`);
  if (c.missingFacts.length) parts.push(`leaves out ${c.missingFacts.map((f) => `"${f}"`).join(", ")}`);
  const s = parts.join("; ");
  return s.charAt(0).toUpperCase() + s.slice(1) + ".";
}
