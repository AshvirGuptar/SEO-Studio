import { z } from "zod";
import { requireEditor } from "@/lib/auth/guard";
import { rateLimit } from "@/lib/net/rate-limit";
import { aiEnabled } from "@/lib/ai/budget";
import { generateJson, GenerateError } from "@/lib/ai/generate";
import {
  ANSWER_FIRST_SCHEMA, ANSWER_FIRST_SYSTEM, AnswerFirstResult, buildGeoPrompt, FAQ_SCHEMA, FAQ_SYSTEM, FaqResult,
  GEO_ESTIMATE_MICROS, GEO_FEATURES, GEO_INPUT_LIMITS,
} from "@/lib/ai/geo-optimize";

/** A streamed rewrite of a long page can take 30–60 s; leave headroom. */
export const maxDuration = 120;

const Body = z.object({
  kind: z.enum(["answer-first", "faq"]),
  keyword: z.string().trim().max(GEO_INPUT_LIMITS.keywordMax).default(""),
  draft: z.string().max(GEO_INPUT_LIMITS.maxChars),
});

/** GEO Optimization AI: answer-first rewrite and FAQ generator. The browser re-scores and fact-checks every result. */
export async function POST(request: Request) {
  const r = await requireEditor();
  if (r.error) return r.error;
  if (!aiEnabled()) return Response.json({ error: "AI isn't set up yet: an admin needs to add ANTHROPIC_API_KEY." }, { status: 503 });
  const limited = await rateLimit(request, "aiGeo", `user:${r.user.id}`);
  if (limited) return limited;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "The page is too long. Try one page of up to about 4,000 words." }, { status: 400 });
  const input = parsed.data;
  if (input.draft.trim().split(/\s+/).length < GEO_INPUT_LIMITS.minWords) {
    return Response.json({ error: `Paste at least ${GEO_INPUT_LIMITS.minWords} words of page copy first: the AI only reuses your facts.` }, { status: 400 });
  }

  try {
    const common = { userId: r.user.id, prompt: buildGeoPrompt(input), estimateMicros: GEO_ESTIMATE_MICROS[input.kind], effort: "medium" as const };
    const result = input.kind === "answer-first"
      ? await generateJson({ ...common, feature: GEO_FEATURES.answerFirst, system: ANSWER_FIRST_SYSTEM, schema: ANSWER_FIRST_SCHEMA, validate: AnswerFirstResult, maxTokens: 12000 })
      : await generateJson({ ...common, feature: GEO_FEATURES.faq, system: FAQ_SYSTEM, schema: FAQ_SCHEMA, validate: FaqResult, maxTokens: 6000 });
    return Response.json({ kind: input.kind, result: result.data, model: result.model, costMicros: result.costMicros });
  } catch (e) {
    if (e instanceof GenerateError) return Response.json({ error: e.message }, { status: e.status });
    console.error("[ai-geo]", e);
    return Response.json({ error: "Something went wrong asking the AI." }, { status: 500 });
  }
}
