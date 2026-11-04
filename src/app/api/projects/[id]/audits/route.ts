import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/guard";
import { createAudit, getProject } from "@/lib/db/repo";

/** Saved audits are capped well under Vercel's 4.5 MB request limit. */
const MAX_BYTES = 4_000_000;

const Body = z.object({
  kind: z.enum(["page", "site"]),
  url: z.string().min(1).max(2048),
  keyword: z.string().max(100).optional().nullable(),
  score: z.number().int().min(0).max(100),
  issueCount: z.number().int().min(0),
  data: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request, ctx: RouteContext<"/api/projects/[id]/audits">) {
  const r = await requireActiveUser();
  if (r.error) return r.error;
  const { id } = await ctx.params;
  if (!(await getProject(id))) return Response.json({ error: "Project not found." }, { status: 404 });

  const text = await request.text();
  if (text.length > MAX_BYTES) return Response.json({ error: "This report is too large to save." }, { status: 413 });
  let json: unknown;
  try { json = JSON.parse(text); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return Response.json({ error: "Invalid audit data." }, { status: 400 });

  return Response.json(await createAudit({ projectId: id, ...parsed.data }, r.user.id), { status: 201 });
}
