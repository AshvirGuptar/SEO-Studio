import { requireActiveUser } from "@/lib/auth/guard";
import { getRun } from "@/lib/db/visibility-repo";
import { aiEnabled } from "@/lib/ai/budget";
import { processNextPrompt } from "@/lib/ai/visibility-runner";

/** One web-search answer can take 20–60s; leave headroom. */
export const maxDuration = 120;

/** Answers the next prompt of a run. The browser calls this in a loop for live progress. */
export async function POST(_req: Request, ctx: RouteContext<"/api/visibility/runs/[runId]/next">) {
  const r = await requireActiveUser();
  if (r.error) return r.error;
  if (!aiEnabled()) return Response.json({ error: "AI isn't set up yet: an admin needs to add ANTHROPIC_API_KEY." }, { status: 503 });
  const { runId } = await ctx.params;
  if (!(await getRun(runId))) return Response.json({ error: "Run not found." }, { status: 404 });
  const outcome = await processNextPrompt(runId, r.user.id);
  if (outcome.kind === "blocked") return Response.json({ error: outcome.reason }, { status: 402 });
  return Response.json(outcome);
}
