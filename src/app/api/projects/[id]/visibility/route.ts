import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/guard";
import { getProject } from "@/lib/db/repo";
import { getActiveRun, getVisibilitySetup, listRunsWithResults, saveVisibilitySetup } from "@/lib/db/visibility-repo";
import { aiEnabled, checkBudget } from "@/lib/ai/budget";
import { serializeRun } from "@/lib/ai/visibility-runner";
import { LIMITS, normalizeDomain } from "@/lib/seo/visibility";

/** Everything the AI Visibility page needs for one project. */
export async function GET(_req: Request, ctx: RouteContext<"/api/projects/[id]/visibility">) {
  const r = await requireActiveUser();
  if (r.error) return r.error;
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "Project not found." }, { status: 404 });
  const [setup, runs, active, budget] = await Promise.all([
    getVisibilitySetup(id), listRunsWithResults(id), getActiveRun(id), checkBudget(r.user.id),
  ]);
  return Response.json({
    project: { id: project.id, name: project.name, domain: project.domain },
    setup: setup ? { prompts: setup.prompts, brands: setup.brands, schedule: setup.schedule, updatedAt: setup.updatedAt } : null,
    runs: runs.map(serializeRun),
    activeRunId: active?.id ?? null,
    ai: { enabled: aiEnabled(), budget },
  });
}

const Brand = z.object({
  name: z.string().trim().min(1).max(80),
  aliases: z.array(z.string().trim().min(1).max(80)).max(LIMITS.maxAliases),
  domains: z.array(z.string().trim().max(255)).max(LIMITS.maxDomains),
  own: z.boolean(),
});

const Body = z.object({
  prompts: z.array(z.string().trim().min(1).max(LIMITS.maxPromptLength)).min(1).max(LIMITS.maxPrompts),
  brands: z.array(Brand).min(1).max(LIMITS.maxCompetitors + 1),
  schedule: z.enum(["off", "weekly"]),
});

export async function PUT(request: Request, ctx: RouteContext<"/api/projects/[id]/visibility">) {
  const r = await requireActiveUser();
  if (r.error) return r.error;
  const { id } = await ctx.params;
  if (!(await getProject(id))) return Response.json({ error: "Project not found." }, { status: 404 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Add at least one prompt and your brand name." }, { status: 400 });
  const { prompts, brands, schedule } = parsed.data;
  if (brands.filter((b) => b.own).length !== 1) return Response.json({ error: "Exactly one brand must be your own." }, { status: 400 });
  const clean = brands.map((b) => ({ ...b, domains: b.domains.map(normalizeDomain).filter((d): d is string => !!d) }));
  const setup = await saveVisibilitySetup(id, { prompts, brands: clean, schedule }, r.user.id);
  return Response.json({ prompts: setup.prompts, brands: setup.brands, schedule: setup.schedule, updatedAt: setup.updatedAt });
}
