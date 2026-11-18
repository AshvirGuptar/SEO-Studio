import { z } from "zod";
import { getAuth, isAuthEnabled, PASSWORD_LIMITS } from "@/lib/auth/server";
import { consumeReset } from "@/lib/db/reset-repo";

const Body = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(PASSWORD_LIMITS.min).max(PASSWORD_LIMITS.max),
});

/** After an admin approved the request: set the new password (once) and sign the account out everywhere. */
export async function POST(request: Request) {
  if (!isAuthEnabled()) return Response.json({ error: "Accounts are off." }, { status: 404 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: `Choose a password of ${PASSWORD_LIMITS.min}–${PASSWORD_LIMITS.max} characters.` }, { status: 400 });
  const target = await consumeReset(parsed.data.token);
  if (!target) return Response.json({ error: "This reset isn't approved, has expired or was already used. Request a new one." }, { status: 400 });

  const c = await getAuth().$context;
  const hash = await c.password.hash(parsed.data.password);
  if (await c.internalAdapter.findCredentialAccount(target.userId)) await c.internalAdapter.updatePassword(target.userId, hash);
  else await c.internalAdapter.createAccount({ userId: target.userId, providerId: "credential", accountId: target.userId, password: hash });
  await c.internalAdapter.deleteUserSessions(target.userId);
  return Response.json({ email: target.email });
}
