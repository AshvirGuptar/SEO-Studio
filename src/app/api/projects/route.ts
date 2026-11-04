import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/guard";
import { createProject, listProjects } from "@/lib/db/repo";

export async function GET() {
  const r = await requireActiveUser();
  if (r.error) return r.error;
  return Response.json(await listProjects());
}

const Body = z.object({ name: z.string().trim().min(1).max(100), domain: z.string().max(255).optional().nullable() });

export async function POST(request: Request) {
  const r = await requireActiveUser();
  if (r.error) return r.error;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Project name is required." }, { status: 400 });
  try {
    return Response.json(await createProject(parsed.data, r.user.id), { status: 201 });
  } catch {
    return Response.json({ error: "A project with that name already exists." }, { status: 409 });
  }
}
