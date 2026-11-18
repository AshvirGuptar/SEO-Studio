import { z } from "zod";
import { isAuthEnabled } from "@/lib/auth/server";
import { getResetStatus } from "@/lib/db/reset-repo";

const Body = z.object({ token: z.string().min(20).max(200) });

/** The requesting browser checks whether an admin has answered yet (POST keeps the token out of URLs). */
export async function POST(request: Request) {
  if (!isAuthEnabled()) return Response.json({ error: "Accounts are off." }, { status: 404 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  return Response.json({ status: await getResetStatus(parsed.data.token) });
}
