import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guard";
import { createInvite, deleteInvite } from "@/lib/db/repo";

const Body = z.object({ email: z.string().trim().email().max(320), role: z.enum(["admin", "member"]).default("member") });

export async function POST(request: Request) {
  const r = await requireAdmin();
  if (r.error) return r.error;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  return Response.json(await createInvite(parsed.data.email, parsed.data.role, r.user.id), { status: 201 });
}

export async function DELETE(request: Request) {
  const r = await requireAdmin();
  if (r.error) return r.error;
  const email = new URL(request.url).searchParams.get("email");
  if (!email) return Response.json({ error: "Missing email." }, { status: 400 });
  await deleteInvite(email);
  return new Response(null, { status: 204 });
}
