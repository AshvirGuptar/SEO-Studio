import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guard";
import { createInvite, deleteInvite, getProject, logAdminAction } from "@/lib/db/repo";

const Body = z.object({
  email: z.string().trim().email().max(320),
  role: z.enum(["admin", "member", "client"]).default("member"),
  /** Required for client invites: the project they'll see. */
  projectId: z.string().max(100).optional().nullable(),
});

export async function POST(request: Request) {
  const r = await requireAdmin();
  if (r.error) return r.error;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  const { email, role, projectId } = parsed.data;
  if (role === "client" && (!projectId || !(await getProject(projectId)))) {
    return Response.json({ error: "Pick the project this client should see." }, { status: 400 });
  }
  const inv = await createInvite(email, role, r.user.id, projectId ?? null);
  await logAdminAction(r.user, "invite.create", inv.email, { role, projectId: inv.projectId });
  return Response.json(inv, { status: 201 });
}

export async function DELETE(request: Request) {
  const r = await requireAdmin();
  if (r.error) return r.error;
  const email = new URL(request.url).searchParams.get("email");
  if (!email) return Response.json({ error: "Missing email." }, { status: 400 });
  await deleteInvite(email);
  await logAdminAction(r.user, "invite.revoke", email.toLowerCase());
  return new Response(null, { status: 204 });
}
