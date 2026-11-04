import { requireActiveUser } from "@/lib/auth/guard";
import { deleteAudit, getAudit } from "@/lib/db/repo";

export async function DELETE(_req: Request, ctx: RouteContext<"/api/audits/[id]">) {
  const r = await requireActiveUser();
  if (r.error) return r.error;
  const { id } = await ctx.params;
  const a = await getAudit(id);
  if (!a) return Response.json({ error: "Audit not found." }, { status: 404 });
  if (r.user.role !== "admin" && a.createdBy !== r.user.id) {
    return Response.json({ error: "Only the person who saved it or an admin can delete it." }, { status: 403 });
  }
  await deleteAudit(id);
  return new Response(null, { status: 204 });
}
