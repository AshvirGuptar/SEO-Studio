import { z } from "zod";
import { isAuthEnabled } from "@/lib/auth/server";
import { resetCode, resetToken } from "@/lib/auth/password";
import { createResetRequest } from "@/lib/db/reset-repo";

const Body = z.object({ email: z.string().trim().email().max(320) });

/**
 * "Forgot password": queue a reset for an admin to approve. Always answers the same way whether or
 * not the email has an account, so the form can't be used to find out who has one.
 */
export async function POST(request: Request) {
  if (!isAuthEnabled()) return Response.json({ error: "Accounts are off." }, { status: 404 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  const result = await createResetRequest(parsed.data.email);
  if (result === "limited") return Response.json({ error: "Too many reset requests for this account today. Try again tomorrow or ask an admin." }, { status: 429 });
  if (result) return Response.json(result);
  // No usable account: a look-alike answer (its token matches nothing, so it just stays "waiting").
  return Response.json({ token: resetToken(), code: resetCode() });
}
