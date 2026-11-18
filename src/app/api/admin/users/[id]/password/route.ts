import { requireAdmin } from "@/lib/auth/guard";
import { getAuth } from "@/lib/auth/server";
import { accessConfigFromEnv } from "@/lib/auth/access";
import { getUser } from "@/lib/db/repo";
import { temporaryPassword } from "@/lib/auth/password";

/**
 * Admin password reset (we can't email reset links yet): sets a new temporary password, signs the
 * person out everywhere, and returns the password once so the admin can pass it on.
 */
export async function POST(_req: Request, ctx: RouteContext<"/api/admin/users/[id]/password">) {
  const r = await requireAdmin();
  if (r.error) return r.error;
  const { id } = await ctx.params;
  const target = await getUser(id);
  if (!target) return Response.json({ error: "User not found." }, { status: 404 });
  if (target.id === r.user.id) return Response.json({ error: "Change your own password on the Account page." }, { status: 400 });
  if (accessConfigFromEnv().adminEmails.includes(target.email.toLowerCase())) {
    return Response.json({ error: "This admin is set in ADMIN_EMAILS; they reset their own password from the Account page." }, { status: 400 });
  }

  const password = temporaryPassword();
  const c = await getAuth().$context;
  const hash = await c.password.hash(password);
  if (await c.internalAdapter.findCredentialAccount(id)) await c.internalAdapter.updatePassword(id, hash);
  else await c.internalAdapter.createAccount({ userId: id, providerId: "credential", accountId: id, password: hash });
  await c.internalAdapter.deleteUserSessions(id);
  return Response.json({ password });
}
