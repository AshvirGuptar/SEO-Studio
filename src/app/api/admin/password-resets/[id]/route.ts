import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guard";
import { decideReset } from "@/lib/db/reset-repo";
import { logAdminAction } from "@/lib/db/repo";

const Body = z.object({ approve: z.boolean() });

/** Approve or deny a "forgot password" request (check the code with the person first). */
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/password-resets/[id]">) {
  const r = await requireAdmin();
  if (r.error) return r.error;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const { id } = await ctx.params;
  const result = await decideReset(id, parsed.data.approve, r.user.id);
  if (result === "not-found") return Response.json({ error: "That request was already answered or has expired." }, { status: 404 });
  if (result === "own") return Response.json({ error: "Another admin has to approve your own reset." }, { status: 403 });
  await logAdminAction(r.user, parsed.data.approve ? "password-reset.approve" : "password-reset.deny", id);
  return Response.json({ ok: true });
}
