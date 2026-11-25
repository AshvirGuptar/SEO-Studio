import { requireEditor } from "@/lib/auth/guard";
import { getProject } from "@/lib/db/repo";
import { getActiveRun, getRunWithResults, getVisibilitySetup } from "@/lib/db/visibility-repo";
import { aiEnabled } from "@/lib/ai/budget";
import { serializeRun, startRun } from "@/lib/ai/visibility-runner";

/** Starts a run. The browser then calls /api/visibility/runs/<id>/next once per prompt. */
export async function POST(_req: Request, ctx: RouteContext<"/api/projects/[id]/visibility/runs">) {
  const r = await requireEditor();
  if (r.error) return r.error;
  if (!aiEnabled()) return Response.json({ error: "AI isn't set up yet: an admin needs to add ANTHROPIC_API_KEY." }, { status: 503 });
  const { id } = await ctx.params;
  if (!(await getProject(id))) return Response.json({ error: "Project not found." }, { status: 404 });
  const setup = await getVisibilitySetup(id);
  if (!setup || setup.prompts.length === 0) return Response.json({ error: "Save some prompts first." }, { status: 400 });

  const active = await getActiveRun(id);
  if (active) return Response.json({ error: "A run is already in progress for this project.", runId: active.id }, { status: 409 });

  const started = await startRun(setup, "manual", r.user.id);
  if (started.error !== undefined) return Response.json({ error: started.error }, { status: 402 });
  const full = await getRunWithResults(started.run.id);
  return Response.json(serializeRun(full!), { status: 201 });
}
