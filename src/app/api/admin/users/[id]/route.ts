import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guard";
import { accessConfigFromEnv } from "@/lib/auth/access";
import { getUser, logAdminAction, setMemberProjects, updateUserAccess } from "@/lib/db/repo";

const Patch = z.object({
  role: z.enum(["admin", "member", "client"]).optional(),
  status: z.enum(["pending", "active", "disabled"]).optional(),
  /** Client's projects (replaces the list). */
  projectIds: z.array(z.string().max(100)).max(100).optional(),
});

export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/users/[id]">) {
  const r = await requireAdmin();
  if (r.error) return r.error;
  const { id } = await ctx.params;
  const parsed = Patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid change." }, { status: 400 });

  const target = await getUser(id);
  if (!target) return Response.json({ error: "User not found." }, { status: 404 });
  if (target.id === r.user.id) return Response.json({ error: "You can't change your own access." }, { status: 400 });
  if (accessConfigFromEnv().adminEmails.includes(target.email.toLowerCase())) {
    return Response.json({ error: "This admin is set in ADMIN_EMAILS. Change it in Vercel's environment variables." }, { status: 400 });
  }
  const { projectIds, ...access } = parsed.data;
  const updated = Object.keys(access).length ? await updateUserAccess(id, access) : target;
  if (projectIds) await setMemberProjects(id, projectIds);
  // Leaving the client role: memberships no longer matter, clear them.
  if (access.role && access.role !== "client" && target.role === "client") await setMemberProjects(id, []);
  await logAdminAction(r.user, "user.update", target.email, { ...access, ...(projectIds ? { projects: projectIds.length } : {}) });
  return Response.json(updated);
}
