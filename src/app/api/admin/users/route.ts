import { requireAdmin } from "@/lib/auth/guard";
import { listInvites, listUsers } from "@/lib/db/repo";

export async function GET() {
  const r = await requireAdmin();
  if (r.error) return r.error;
  const [users, invites] = await Promise.all([listUsers(), listInvites()]);
  return Response.json({ users, invites });
}
