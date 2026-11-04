import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/guard";
import { deleteProject, getProject, listAudits, updateProject } from "@/lib/db/repo";

export async function GET(_req: Request, ctx: RouteContext<"/api/projects/[id]">) {
  const r = await requireActiveUser();
  if (r.error) return r.error;
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "Project not found." }, { status: 404 });
  return Response.json({ project, audits: await listAudits(id) });
}

const Patch = z.object({ name: z.string().trim().min(1).max(100).optional(), domain: z.string().max(255).optional().nullable() });

export async function PATCH(request: Request, ctx: RouteContext<"/api/projects/[id]">) {
  const r = await requireActiveUser();
  if (r.error) return r.error;
  const { id } = await ctx.params;
  const parsed = Patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid project details." }, { status: 400 });
  try {
    const p = await updateProject(id, parsed.data);
    return p ? Response.json(p) : Response.json({ error: "Project not found." }, { status: 404 });
  } catch {
    return Response.json({ error: "A project with that name already exists." }, { status: 409 });
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/projects/[id]">) {
  const r = await requireActiveUser();
  if (r.error) return r.error;
  const { id } = await ctx.params;
  const p = await getProject(id);
  if (!p) return Response.json({ error: "Project not found." }, { status: 404 });
  if (r.user.role !== "admin" && p.createdBy !== r.user.id) {
    return Response.json({ error: "Only the project's creator or an admin can delete it." }, { status: 403 });
  }
  await deleteProject(id);
  return new Response(null, { status: 204 });
}
