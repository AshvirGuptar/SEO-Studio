/**
 * Product specs ("Specs" / "Details" tab) and copy-level GEO checks for the Content Optimizer.
 * Specs are pasted one per line, ideally "Label: Value". Pure, runs in the browser.
 */
import type { Check } from "./types";
import { containsPhrase, words } from "./text";

export interface Spec {
  label: string;
  value: string;
}

export interface ParsedSpecs {
  specs: Spec[];
  /** Non-empty lines that didn't look like "Label: Value". */
  unstructured: string[];
}

const SEPARATOR = /^\s*[-•*]?\s*([^:|\t=]{1,40}?)\s*(?::|\t|\||=|\s[-–—]\s)\s*(.+)$/;

export function parseSpecs(text: string): ParsedSpecs {
  const specs: Spec[] = [];
  const unstructured: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(SEPARATOR);
    if (m && m[2].trim()) specs.push({ label: m[1].trim().replace(/^[-•*]\s*/, ""), value: m[2].trim() });
    else unstructured.push(line);
  }
  return { specs, unstructured };
}

export const SPEC_LIMITS = { minAttributes: 5, goodAttributes: 8, minStructuredShare: 0.8 } as const;

/** Attributes shoppers (and AI shopping answers) compare on. Matched against spec labels. */
const KEY_ATTRIBUTES: { name: string; re: RegExp }[] = [
  { name: "compatibility", re: /compatib|fits|fitment|platform|caliber|calibre|model/i },
  { name: "weight", re: /weight|weighs|mass/i },
  { name: "size / dimensions", re: /size|sizing|dimension|length|width|height|depth|fit/i },
  { name: "material", re: /material|fabric|upper|lining|made of|construction|composition/i },
  { name: "color", re: /colou?r|finish/i },
  { name: "care / warranty", re: /care|wash|warranty|guarantee/i },
];

const UNIT = /(\d)\s*(%|mm|cm|m\b|km|in\b|inch|inches|"|ft|feet|oz|lb|lbs|g\b|kg|ml|l\b|liters?|litres?|gal|mah|w\b|v\b|hz|gb|tb|°|deg|hours?|hrs?|h\b|mins?|years?|yrs?|days?|us\b|uk\b|eu\b)/i;
/** Sizing systems written before the number ("US 7–13", "EU 40", "Size 10"). */
const UNIT_PREFIX = /\b(us|uk|eu|au|jp|size|sz|ages?)\s*\d/i;
const hasUnit = (v: string) => UNIT.test(v) || UNIT_PREFIX.test(v);
const NUMBER = /\d/;

export function analyzeSpecs(text: string, opts: { keyword?: string; preset?: string } = {}): Check[] {
  const { specs, unstructured } = parseSpecs(text);
  const total = specs.length + unstructured.length;
  if (total === 0) return [];
  const checks: Check[] = [];

  checks.push({
    id: "specs-count", category: "content", label: "Spec attributes", weight: 4, value: `${specs.length} attributes`,
    ...(specs.length >= SPEC_LIMITS.minAttributes
      ? { severity: "pass", message: "Enough attributes for shoppers and search engines to compare the product." }
      : { severity: "warn", message: "Only a few specs listed.", fix: `List at least ${SPEC_LIMITS.minAttributes} attributes (compatibility, materials, finish/color, dimensions, weight, warranty…).` }),
  });

  const share = specs.length / total;
  checks.push({
    id: "specs-structured", category: "content", label: "Consistent “Label: Value” format", weight: 3, value: `${specs.length}/${total} lines`,
    ...(share >= SPEC_LIMITS.minStructuredShare
      ? { severity: "pass", message: "Specs are clean label/value pairs, easy to render as a table and for machines to parse." }
      : { severity: "warn", message: "Some lines aren't label/value pairs.", fix: "Write one spec per line as “Label: Value” (e.g. “Weight: 1.1 kg”)." }),
  });

  const numeric = specs.filter((s) => NUMBER.test(s.value));
  if (numeric.length > 0) {
    const withUnits = numeric.filter((s) => hasUnit(s.value));
    checks.push({
      id: "specs-units", category: "content", label: "Units on measurements", weight: 3, value: `${withUnits.length}/${numeric.length}`,
      ...(withUnits.length / numeric.length >= 0.8
        ? { severity: "pass", message: "Measurements include units." }
        : { severity: "warn", message: "Some numbers have no unit.", fix: "Add units (kg/lb, cm/in, oz, mAh, hours…) so values are unambiguous." }),
    });
  }

  if (opts.preset !== "blog") {
    const present = KEY_ATTRIBUTES.filter((a) => specs.some((s) => a.re.test(s.label)));
    const missing = KEY_ATTRIBUTES.filter((a) => !present.includes(a));
    checks.push({
      id: "specs-key-attributes", category: "content", label: "Key shopping attributes", weight: 4,
      value: `${present.length}/${KEY_ATTRIBUTES.length}`,
      ...(present.length >= 3
        ? { severity: "pass", message: `Covers ${present.map((a) => a.name).join(", ")}.` }
        : { severity: "warn", message: `Missing common attributes: ${missing.map((a) => a.name).join(", ")}.`, fix: "Add the attributes people filter and ask about, where they apply to this product." }),
    });
  }

  if (opts.keyword) {
    checks.push({
      id: "specs-keyword", category: "keywords", label: "Keyword terms in specs", weight: 1,
      ...(containsPhrase(text, opts.keyword) || words(opts.keyword).some((w) => w.length > 3 && containsPhrase(text, w))
        ? { severity: "pass", message: "Specs reinforce the target keyword's terms." }
        : { severity: "info", message: "Specs don't mention the keyword's terms. Fine if it would be unnatural." }),
    });
  }

  return checks;
}

const LEAD = { min: 15, max: 80 } as const;
const FACT = /\b\d[\d,.]*\s?(%|percent|mm|cm|m\b|km|in\b|inch(es)?|ft|oz|lbs?|g\b|kg|ml|l\b|mah|hours?|days?|years?|miles?|\$)|\$\s?\d/gi;

/**
 * GEO checks that apply to raw copy (no HTML yet): is it easy for AI answer engines to quote?
 */
export function analyzeCopyGeo(body: string, specsText: string): Check[] {
  const checks: Check[] = [];
  const paragraphs = body.split(/\n\s*\n|\r?\n/).map((p) => p.trim()).filter(Boolean);
  const lead = paragraphs[0] ? words(paragraphs[0]).length : 0;
  const { specs } = parseSpecs(specsText);

  if (body.trim()) {
    checks.push({
      id: "geo-copy-lead", category: "answer-ready", label: "Answer-first opening", weight: 5, value: `${lead} words`,
      ...(lead >= LEAD.min && lead <= LEAD.max
        ? { severity: "pass", message: "Opens with a concise summary AI answers can quote directly." }
        : { severity: "warn", message: lead > LEAD.max ? "The first paragraph is long; the key point gets buried." : "The opening is very short.",
            fix: `Start with a ${LEAD.min}–${LEAD.max} word paragraph: what it is, who it's for, the main benefit.` }),
    });
  }

  const facts = (body.match(FACT) ?? []).length + specs.filter((s) => /\d/.test(s.value)).length;
  checks.push({
    id: "geo-copy-facts", category: "trust", label: "Concrete facts & numbers", weight: 4, value: `${facts} found`,
    ...(facts >= 5
      ? { severity: "pass", message: "Plenty of specific, verifiable details (sizes, weights, prices, durations)." }
      : { severity: facts >= 2 ? "warn" : "fail", message: "Few concrete facts; AI engines prefer quotable specifics.",
          fix: "Add measurable details in the copy or specs: weight, dimensions, materials, compatibility, warranty length." }),
  });

  if (specs.length > 0) {
    checks.push({
      id: "geo-specs-structured", category: "answer-ready", label: "Specs as structured facts", weight: 4, value: `${specs.length} attributes`,
      ...(specs.length >= SPEC_LIMITS.minAttributes
        ? { severity: "pass", message: "Label/value specs are exactly what AI shopping answers extract and compare." }
        : { severity: "warn", message: "A short spec list gives AI little to compare.", fix: `Aim for ${SPEC_LIMITS.goodAttributes}+ attributes.` }),
    });
    checks.push({
      id: "geo-specs-html", category: "ai-access", label: "Specs readable by AI crawlers", weight: 1, severity: "info",
      message: "Click-to-open spec tabs are fine as long as the text is in the page's HTML. If the tab loads its content with JavaScript, AI crawlers won't see it. Render specs as a <table> or <dl> (verify with the Page Analyzer).",
    });
  } else {
    checks.push({
      id: "geo-specs-structured", category: "answer-ready", label: "Specs as structured facts", weight: 2, severity: "info",
      message: "No specs added. A spec list (weight, size, material…) helps AI shopping answers compare products.",
    });
  }

  if (/\?\s*$/m.test(body)) {
    checks.push({ id: "geo-copy-questions", category: "answer-ready", label: "Answers real questions", weight: 2, severity: "pass",
      message: "The copy addresses questions directly, matching how people ask AI assistants." });
  } else if (words(body).length > 120) {
    checks.push({ id: "geo-copy-questions", category: "answer-ready", label: "Answers real questions", weight: 2, severity: "info",
      message: "Consider a short FAQ (sizing, care, compatibility); it matches how people prompt AI assistants." });
  }

  return checks;
}
