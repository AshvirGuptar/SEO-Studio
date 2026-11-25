import { z } from "zod";
import { requireEditor, requireProjectView } from "@/lib/auth/guard";
import { deleteRun, getRun, getRunWithResults, stopRun } from "@/lib/db/visibility-repo";
import { serializeRun } from "@/lib/ai/visibility-runner";

export async function GET(_req: Request, ctx: RouteContext<"/api/visibility/runs/[runId]">) {
  const { runId } = await ctx.params;
  const run = await getRunWithResults(runId);
  if (!run) return Response.json({ error: "Run not found." }, { status: 404 });
  const r = await requireProjectView(run.projectId);
  if (r.error) return r.error;
  return Response.json(serializeRun(run));
}

const Patch = z.object({ action: z.literal("stop") });

/** Stop a run: prompts not yet asked are skipped, answers so far are kept. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/visibility/runs/[runId]">) {
  const r = await requireEditor();
  if (r.error) return r.error;
  const { runId } = await ctx.params;
  if (!Patch.safeParse(await request.json().catch(() => null)).success) return Response.json({ error: "Unknown action." }, { status: 400 });
  if (!(await getRun(runId))) return Response.json({ error: "Run not found." }, { status: 404 });
  await stopRun(runId);
  return Response.json(serializeRun((await getRunWithResults(runId))!));
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/visibility/runs/[runId]">) {
  const r = await requireEditor();
  if (r.error) return r.error;
  const { runId } = await ctx.params;
  const run = await getRun(runId);
  if (!run) return Response.json({ error: "Run not found." }, { status: 404 });
  if (r.user.role !== "admin" && run.createdBy !== r.user.id) {
    return Response.json({ error: "Only the person who started this run or an admin can delete it." }, { status: 403 });
  }
  await deleteRun(runId);
  return new Response(null, { status: 204 });
}
