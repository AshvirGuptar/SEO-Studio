/**
 * AI for GEO Optimization: the answer-first rewrite and the FAQ generator. Fixed instructions,
 * request builders, output schemas and the scoring of each result. Pure (no SDK, no server APIs), so
 * the API route and tests send the same prompts and judge results the same way. Every result is
 * re-scored by the deterministic GEO engine and fact-checked before it's shown as acceptable.
 */
import { z } from "zod";
import { summarize } from "../seo/score";
import { checkFacts, type FactCheck } from "../seo/facts";
import { analyzeDraftGeo, parseDraft, type FaqItem } from "../seo/geo-optimize";
import { GEO_LIMITS } from "../seo/geo";
import { words } from "../seo/text";

export const GEO_FEATURES = { answerFirst: "geo-answer-first", faq: "geo-faq" } as const;
export type GeoAiKind = "answer-first" | "faq";

/** Rough upper costs on Opus 5.5 (answer-first ≈ 6k in + 4k out; FAQ ≈ 5k in + 2k out). */
export const GEO_ESTIMATE_MICROS = { "answer-first": 120_000, faq: 70_000 } as const;
export const FAQ_COUNT = { min: 3, max: 8 } as const;
export const GEO_INPUT_LIMITS = { minWords: 40, maxChars: 30_000, keywordMax: 100 } as const;

export interface GeoAiInput {
  kind: GeoAiKind;
  keyword: string;
  /** The page draft in simple Markdown. */
  draft: string;
}

const FACT_RULES = `Facts are fixed. This rule overrides every other instruction:
- Use only facts stated in the original page. Never add a number, price, size, capacity, speed, date, percentage, rating, spec, model name, statistic or source that isn't in the original.
- Never add claims the original doesn't make: free shipping, guarantees, warranties, certifications, awards, "#1", "best-selling", lifetime, money-back, clinically proven, waterproof, organic, eco-friendly, patented, sales or discounts.
- Keep every number and spec value exactly as written (same digits and units).
- Don't mention competitors or other sites. Write in the same language as the original.`;

/** Fixed instructions (identical on every request, so they're cached). Never names a brand. */
export const ANSWER_FIRST_SYSTEM = `You are a GEO (generative engine optimization) editor. You restructure web pages so AI answer
engines such as ChatGPT search, Perplexity, Google AI Overviews and Claude can find, quote and cite them.

${FACT_RULES}

Restructure the page answer-first:
- Start with a ${GEO_LIMITS.leadMin}–${GEO_LIMITS.leadMax} word summary paragraph: what the page is about, who it's for and the key takeaway, using the target keyword naturally.
- Use "## " headings phrased as the real questions people ask (How…? What…? Which…? Can…?), drawn from what the page actually covers.
- Directly under each question heading, answer it in one self-contained paragraph of ${GEO_LIMITS.answerMin}–${GEO_LIMITS.answerMax} words, then add any detail.
- Keep paragraphs to 2–4 sentences. Put steps, specs and comparisons in "- " lists or Markdown tables.
- Keep every section under ${GEO_LIMITS.sectionMax} words. Keep all the original's substance; reorder and rephrase, don't drop useful facts.

Output simple Markdown only: one "# " title, "## " / "### " headings, blank lines between paragraphs, "- " lists, "| a | b |" tables. No HTML, no links you weren't given, no emphasis markers.
In "summary", say in one or two sentences what you changed.`;

export const FAQ_SYSTEM = `You write FAQ sections for web pages, used for on-page FAQs and FAQPage structured data that AI
answer engines read.

${FACT_RULES}

- Write questions a real customer or reader would ask an AI assistant about this page's topic, phrased naturally and ending with "?".
- Only ask questions the page itself answers. Skip anything the page doesn't cover rather than guessing.
- Each answer is ${GEO_LIMITS.answerMin}–${GEO_LIMITS.answerMax} words, plain text, self-contained (it makes sense without the page), and starts with the direct answer.
- No duplicates, no marketing fluff, no links.`;

export function buildGeoPrompt(i: GeoAiInput): string {
  const task = i.kind === "answer-first"
    ? "Rewrite this page answer-first, following the rules."
    : `Write ${FAQ_COUNT.min}–${FAQ_COUNT.max} questions and answers from this page's content only.`;
  return [task, `Target keyword: ${i.keyword || "(none given; infer the main topic)"}`, "", "<original_page>", i.draft, "</original_page>"].join("\n");
}

export const ANSWER_FIRST_SCHEMA = {
  type: "object",
  properties: { markdown: { type: "string" }, summary: { type: "string" } },
  required: ["markdown", "summary"],
  additionalProperties: false,
} as const;

export const FAQ_SCHEMA = {
  type: "object",
  properties: {
    faqs: {
      type: "array",
      items: {
        type: "object",
        properties: { question: { type: "string" }, answer: { type: "string" } },
        required: ["question", "answer"],
        additionalProperties: false,
      },
    },
  },
  required: ["faqs"],
  additionalProperties: false,
} as const;

export const AnswerFirstResult = z.object({ markdown: z.string().min(1).max(60_000), summary: z.string().max(1000) });
export const FaqResult = z.object({
  faqs: z.array(z.object({ question: z.string().min(1).max(300), answer: z.string().min(1).max(3000) })).min(1).max(12),
});
export type AnswerFirstResult = z.infer<typeof AnswerFirstResult>;
export type FaqResult = z.infer<typeof FaqResult>;

/** Everything a result may draw facts from. */
export const geoFactSource = (i: Pick<GeoAiInput, "keyword" | "draft">) => `${i.keyword}\n${i.draft}`;

export interface ScoredAnswerFirst {
  markdown: string;
  summary: string;
  geoBefore: number;
  geoAfter: number;
  facts: FactCheck;
}

/** Re-scores the rewrite with the GEO engine and checks that every number survived and nothing was added. */
export function scoreAnswerFirst(input: GeoAiInput, result: AnswerFirstResult): ScoredAnswerFirst {
  return {
    ...result,
    geoBefore: summarize(analyzeDraftGeo(input.draft)).score,
    geoAfter: summarize(analyzeDraftGeo(result.markdown)).score,
    facts: checkFacts(geoFactSource(input), result.markdown, { mode: "preserve", preserveFrom: parseDraft(input.draft).plainText }),
  };
}

export interface ScoredFaq extends FaqItem {
  facts: FactCheck;
  words: number;
  /** Answer length is in the range AI engines lift as-is. */
  directAnswer: boolean;
}

/** Fact-checks each Q&A (no invented numbers or claims) and checks the answer length. */
export function scoreFaqs(input: GeoAiInput, result: FaqResult): ScoredFaq[] {
  const source = geoFactSource(input);
  return result.faqs.map((f) => {
    const n = words(f.answer).length;
    return {
      question: f.question.trim(), answer: f.answer.trim(), words: n,
      directAnswer: n >= GEO_LIMITS.answerMin && n <= GEO_LIMITS.answerMax,
      facts: checkFacts(source, `${f.question}\n${f.answer}`, { mode: "no-invent" }),
    };
  });
}
