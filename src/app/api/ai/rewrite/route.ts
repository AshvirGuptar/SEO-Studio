import { z } from "zod";
import { requireEditor } from "@/lib/auth/guard";
import { rateLimit } from "@/lib/net/rate-limit";
import { aiEnabled } from "@/lib/ai/budget";
import { generateJson, GenerateError } from "@/lib/ai/generate";
import {
  buildRewritePrompt, DESCRIPTION_SCHEMA, DescriptionResult, REWRITE_ESTIMATE_MICROS, REWRITE_FEATURE, REWRITE_SYSTEM,
  TITLE_META_SCHEMA, TitleMetaResult, TONES,
} from "@/lib/ai/rewrite";

/** A streamed rewrite usually takes 10–30 s; leave headroom. */
export const maxDuration = 90;

const Body = z.object({
  kind: z.enum(["title-meta", "description"]),
  keyword: z.string().trim().max(100).default(""),
  title: z.string().max(300).default(""),
  meta: z.string().max(600).default(""),
  body: z.string().max(20_000).default(""),
  specs: z.string().max(5_000).default(""),
  preset: z.enum(["product", "category", "blog"]).default("product"),
  tone: z.enum(TONES).default("clear"),
});

/** AI rewrite for the Content Optimizer. The browser re-scores and fact-checks every suggestion. */
export async function POST(request: Request) {
  const r = await requireEditor();
  if (r.error) return r.error;
  if (!aiEnabled()) return Response.json({ error: "AI isn't set up yet: an admin needs to add ANTHROPIC_API_KEY." }, { status: 503 });
  const limited = await rateLimit(request, "aiRewrite", `user:${r.user.id}`);
  if (limited) return limited;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Some fields are too long to rewrite." }, { status: 400 });
  const input = parsed.data;
  if (input.kind === "title-meta" && !input.title.trim() && !input.body.trim() && !input.keyword) {
    return Response.json({ error: "Add a title, keyword or description first." }, { status: 400 });
  }
  if (input.kind === "description" && input.body.trim().split(/\s+/).length < 15) {
    return Response.json({ error: "Write at least a couple of sentences of description first: the rewrite only reuses your facts." }, { status: 400 });
  }

  try {
    const common = {
      feature: REWRITE_FEATURE, userId: r.user.id, system: REWRITE_SYSTEM, prompt: buildRewritePrompt(input),
      estimateMicros: REWRITE_ESTIMATE_MICROS, effort: "medium" as const,
    };
    const result = input.kind === "title-meta"
      ? await generateJson({ ...common, schema: TITLE_META_SCHEMA, validate: TitleMetaResult, maxTokens: 6000 })
      : await generateJson({ ...common, schema: DESCRIPTION_SCHEMA, validate: DescriptionResult, maxTokens: 10000 });
    return Response.json({ kind: input.kind, result: result.data, model: result.model, costMicros: result.costMicros });
  } catch (e) {
    if (e instanceof GenerateError) return Response.json({ error: e.message }, { status: e.status });
    console.error("[ai-rewrite]", e);
    return Response.json({ error: "Something went wrong with the rewrite." }, { status: 500 });
  }
}
