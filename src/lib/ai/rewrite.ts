/**
 * AI rewrite for the Content Optimizer: the fixed instructions, request builder, output schemas and
 * the scoring of each suggestion. Pure (no SDK, no server APIs), so the app's API route and the
 * evaluation runner (docs/eval) send exactly the same prompts and judge results the same way.
 */
import { z } from "zod";
import { LIMITS, analyzeBodyCopy, analyzeMetaDescription, analyzeTitle } from "../seo/copy";
import { analyzeCopyGeo } from "../seo/specs";
import { summarize } from "../seo/score";
import { checkFacts, type FactCheck } from "../seo/facts";

export const REWRITE_FEATURE = "ai-rewrite";
export const TONES = ["clear", "friendly", "expert", "premium"] as const;
export type Tone = (typeof TONES)[number];
export const TONE_LABEL: Record<Tone, string> = { clear: "Clear & direct", friendly: "Friendly", expert: "Expert", premium: "Premium" };

export const VARIANT_COUNT = 4;
/** Rough upper cost of one rewrite (about 6k input + 3k output tokens on Opus 5.5). */
export const REWRITE_ESTIMATE_MICROS = 100_000;

export interface RewriteInput {
  kind: "title-meta" | "description";
  keyword: string;
  title: string;
  meta: string;
  body: string;
  specs: string;
  preset: "product" | "category" | "blog";
  tone: Tone;
}

/** Fixed instructions: identical on every request, so the API caches them. Never names a brand. */
export const REWRITE_SYSTEM = `You are an SEO and GEO copywriter. You rewrite web page copy so it ranks in search engines
(SEO) and is easy for AI answer engines such as ChatGPT search, Perplexity, Google AI Overviews and Claude to quote and cite (GEO).

Facts are fixed. This rule overrides every other instruction:
- Never add a number, price, size, capacity, speed, date, percentage, rating, spec or model name that is not in the original copy or the target keyword.
- Never add claims the original doesn't make: free shipping, guarantees, warranties, certifications, awards, "#1", "best-selling", lifetime, money-back, clinically proven, waterproof, organic, eco-friendly, patented, sales or discounts.
- Keep every number and spec value exactly as written (same digits and units). You may reorder and rephrase around them.
- Don't mention competitors or other stores. Write in the same language as the original.

Titles (search result headline):
- ${LIMITS.titleMinChars}–${LIMITS.titleMaxChars} characters, keyword (or its main words) near the start.
- If the original title ends with a brand or store name after "|" or "-", keep it at the end.
- Specific beats clever: say what the page is and who it's for. No ALL CAPS, no clickbait.

Meta descriptions (search result snippet):
- ${LIMITS.metaMinChars}–155 characters, include the keyword naturally once.
- One concrete benefit or fact from the original, then a short call to action.

Descriptions (body copy):
- Start with a one- or two-sentence direct answer: what it is, who it's for, and the main reason to choose it, using the keyword.
- Then short paragraphs (2–4 sentences). Bring the most useful facts from the original forward.
- Use the keyword naturally (roughly 1–2% of words); no stuffing, no filler, no hype words without a fact behind them.
- Plain text only: paragraphs separated by a blank line, no markdown, no headings symbols, no lists of specs (the specs table stays separate).

Tone: follow the requested tone without changing any fact.`;

const TONE_HINT: Record<Tone, string> = {
  clear: "Clear and direct: plain words, short sentences.",
  friendly: "Friendly and approachable, like a helpful store expert.",
  expert: "Knowledgeable and precise, for buyers who compare specs.",
  premium: "Polished and confident, understated rather than salesy.",
};

/** The request-specific message (everything that varies between requests). */
export function buildRewritePrompt(i: RewriteInput): string {
  const task = i.kind === "title-meta"
    ? `Write ${VARIANT_COUNT} different title + meta description pairs. Make them genuinely different angles (for example: benefit-led, spec-led, use-case-led, question-led).`
    : `Rewrite the description (body copy) for a ${i.preset} page. Keep every number, price and spec value from the original description and specs.`;
  return [
    task,
    `Tone: ${TONE_HINT[i.tone]}`,
    `Target keyword: ${i.keyword || "(none given; infer the main topic)"}`,
    `Page type: ${i.preset}`,
    "",
    "<original_title>", i.title, "</original_title>",
    "<original_meta>", i.meta, "</original_meta>",
    "<original_description>", i.body, "</original_description>",
    "<specs>", i.specs || "(none)", "</specs>",
  ].join("\n");
}

export const TITLE_META_SCHEMA = {
  type: "object",
  properties: {
    variants: {
      type: "array",
      items: {
        type: "object",
        properties: { title: { type: "string" }, meta: { type: "string" }, angle: { type: "string" } },
        required: ["title", "meta", "angle"],
        additionalProperties: false,
      },
    },
  },
  required: ["variants"],
  additionalProperties: false,
} as const;

export const DESCRIPTION_SCHEMA = {
  type: "object",
  properties: { description: { type: "string" }, summary: { type: "string" } },
  required: ["description", "summary"],
  additionalProperties: false,
} as const;

export const TitleMetaResult = z.object({
  variants: z.array(z.object({ title: z.string().min(1).max(300), meta: z.string().max(600), angle: z.string().max(200) })).min(1).max(8),
});
export const DescriptionResult = z.object({ description: z.string().min(1).max(20_000), summary: z.string().max(1000) });
export type TitleMetaResult = z.infer<typeof TitleMetaResult>;
export type DescriptionResult = z.infer<typeof DescriptionResult>;

/** Everything the rewrite was allowed to draw facts from. */
export function factSource(i: Pick<RewriteInput, "keyword" | "title" | "meta" | "body" | "specs">): string {
  return [i.keyword, i.title, i.meta, i.body, i.specs].join("\n");
}

export interface ScoredTitleMeta {
  title: string;
  meta: string;
  angle: string;
  titleScore: number;
  metaScore: number;
  facts: FactCheck;
}

/** Re-scores each suggestion with our own engine and fact-checks it. */
export function scoreTitleMeta(input: RewriteInput, result: TitleMetaResult): ScoredTitleMeta[] {
  const kw = input.keyword.trim() || undefined;
  const source = factSource(input);
  return result.variants.map((v) => ({
    ...v,
    titleScore: summarize(analyzeTitle(v.title, kw)).score,
    metaScore: summarize(analyzeMetaDescription(v.meta, kw)).score,
    facts: checkFacts(source, `${v.title}\n${v.meta}`, { mode: "no-invent" }),
  }));
}

const MIN_WORDS = { product: 150, category: 250, blog: 800 } as const;

export interface ScoredDescription {
  description: string;
  summary: string;
  seoBefore: number;
  seoAfter: number;
  geoBefore: number;
  geoAfter: number;
  facts: FactCheck;
}

export function scoreDescription(input: RewriteInput, result: DescriptionResult, requiredFacts: string[] = []): ScoredDescription {
  const kw = input.keyword.trim() || undefined;
  const opts = { minWords: MIN_WORDS[input.preset] };
  return {
    ...result,
    seoBefore: summarize(analyzeBodyCopy(input.body, kw, opts)).score,
    seoAfter: summarize(analyzeBodyCopy(result.description, kw, opts)).score,
    geoBefore: summarize(analyzeCopyGeo(input.body, input.specs)).score,
    geoAfter: summarize(analyzeCopyGeo(result.description, input.specs)).score,
    // Numbers only need to survive from the description itself; specs stay in their own table.
    facts: checkFacts(`${input.keyword}\n${input.body}\n${input.specs}`, result.description, { mode: "preserve", requiredFacts, preserveFrom: input.body }),
  };
}
