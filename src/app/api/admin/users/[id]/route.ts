import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guard";
import { accessConfigFromEnv } from "@/lib/auth/access";
import { getUser, updateUserAccess } from "@/lib/db/repo";

const Patch = z.object({ role: z.enum(["admin", "member"]).optional(), status: z.enum(["pending", "active", "disabled"]).optional() });

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
  return Response.json(await updateUserAccess(id, parsed.data));
}
