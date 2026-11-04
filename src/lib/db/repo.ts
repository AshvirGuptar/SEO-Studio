/** All database reads/writes for SEO Studio's own tables. Route handlers stay thin. */
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { getDb } from "./index";
import { audit, invite, project, user, type Audit, type Invite, type Project, type User } from "./schema";
import { accessConfigFromEnv, decideAccess, type Role, type Status } from "../auth/access";

const newId = () => crypto.randomUUID();

// ---------- users & access ----------
export async function listUsers(): Promise<User[]> {
  return getDb().select().from(user).orderBy(user.status, user.createdAt);
}

export async function getUser(id: string): Promise<User | undefined> {
  const [u] = await getDb().select().from(user).where(eq(user.id, id));
  return u;
}

export async function updateUserAccess(id: string, patch: { role?: Role; status?: Status }): Promise<User | undefined> {
  const [u] = await getDb().update(user).set({ ...patch, updatedAt: new Date() }).where(eq(user.id, id)).returning();
  return u;
}

/**
 * Re-evaluate a user's access (called on every sign-in): picks up new invites, env admin changes and
 * auto-approve domains. Consumes the invite once used.
 */
export async function applyAccessOnSignIn(userId: string): Promise<User | undefined> {
  const u = await getUser(userId);
  if (!u) return undefined;
  const inv = await getInvite(u.email);
  const next = decideAccess(u.email, accessConfigFromEnv(), { current: { role: u.role, status: u.status }, invite: inv });
  if (inv && next.status === "active") await deleteInvite(inv.email);
  if (next.role === u.role && next.status === u.status) return u;
  return updateUserAccess(u.id, next);
}

// ---------- invites ----------
export async function listInvites(): Promise<Invite[]> {
  return getDb().select().from(invite).orderBy(desc(invite.createdAt));
}

export async function getInvite(email: string): Promise<Invite | undefined> {
  const [i] = await getDb().select().from(invite).where(eq(invite.email, email.toLowerCase()));
  return i;
}

export async function createInvite(email: string, role: Role, invitedBy: string | null): Promise<Invite> {
  const e = email.trim().toLowerCase();
  const [i] = await getDb()
    .insert(invite)
    .values({ email: e, role, invitedBy })
    .onConflictDoUpdate({ target: invite.email, set: { role, invitedBy } })
    .returning();
  // If that person already signed up and is waiting, let them in now.
  const [existing] = await getDb().select().from(user).where(eq(user.email, e));
  if (existing && existing.status === "pending") {
    await updateUserAccess(existing.id, { role, status: "active" });
    await deleteInvite(e);
  }
  return i;
}

export async function deleteInvite(email: string): Promise<void> {
  await getDb().delete(invite).where(eq(invite.email, email.toLowerCase()));
}

// ---------- projects ----------
export interface ProjectSummary extends Project {
  auditCount: number;
  lastScore: number | null;
  lastAuditAt: Date | null;
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const db = getDb();
  const rows = await db
    .select({
      p: project,
      auditCount: sql<number>`count(${audit.id})::int`,
      lastAuditAt: sql<Date | null>`max(${audit.createdAt})`,
    })
    .from(project)
    .leftJoin(audit, eq(audit.projectId, project.id))
    .groupBy(project.id)
    .orderBy(desc(project.updatedAt));

  // Latest score per project (one small query per project keeps this simple and portable).
  return Promise.all(
    rows.map(async (r) => {
      const [last] = await db.select({ score: audit.score }).from(audit).where(eq(audit.projectId, r.p.id)).orderBy(desc(audit.createdAt)).limit(1);
      return { ...r.p, auditCount: Number(r.auditCount), lastAuditAt: r.lastAuditAt ? new Date(r.lastAuditAt) : null, lastScore: last?.score ?? null };
    }),
  );
}

export async function getProject(id: string): Promise<Project | undefined> {
  const [p] = await getDb().select().from(project).where(eq(project.id, id));
  return p;
}

export async function createProject(input: { name: string; domain?: string | null }, createdBy: string | null): Promise<Project> {
  const [p] = await getDb()
    .insert(project)
    .values({ id: newId(), name: input.name.trim(), domain: normalizeDomain(input.domain), createdBy })
    .returning();
  return p;
}

export async function updateProject(id: string, input: { name?: string; domain?: string | null }): Promise<Project | undefined> {
  const patch: Partial<Project> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.domain !== undefined) patch.domain = normalizeDomain(input.domain);
  const [p] = await getDb().update(project).set(patch).where(eq(project.id, id)).returning();
  return p;
}

export async function deleteProject(id: string): Promise<void> {
  await getDb().delete(project).where(eq(project.id, id));
}

export function normalizeDomain(d: string | null | undefined): string | null {
  if (!d?.trim()) return null;
  const s = d.trim();
  try {
    return new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`).hostname.toLowerCase();
  } catch {
    return s.toLowerCase();
  }
}

// ---------- audits ----------
export type AuditListItem = Omit<Audit, "data">;

export async function createAudit(input: {
  projectId: string;
  kind: "page" | "site";
  url: string;
  keyword?: string | null;
  score: number;
  issueCount: number;
  data: unknown;
}, createdBy: string | null): Promise<AuditListItem> {
  const db = getDb();
  const [a] = await db
    .insert(audit)
    .values({ id: newId(), ...input, keyword: input.keyword || null, createdBy })
    .returning({
      id: audit.id, projectId: audit.projectId, kind: audit.kind, url: audit.url, keyword: audit.keyword,
      score: audit.score, issueCount: audit.issueCount, createdBy: audit.createdBy, createdAt: audit.createdAt,
    });
  await db.update(project).set({ updatedAt: new Date() }).where(eq(project.id, input.projectId));
  return a;
}

const listColumns = {
  id: audit.id, projectId: audit.projectId, kind: audit.kind, url: audit.url, keyword: audit.keyword,
  score: audit.score, issueCount: audit.issueCount, createdBy: audit.createdBy, createdAt: audit.createdAt,
};

export async function listAudits(projectId: string, limit = 500): Promise<(AuditListItem & { createdByName: string | null })[]> {
  return getDb()
    .select({ ...listColumns, createdByName: user.name })
    .from(audit)
    .leftJoin(user, eq(user.id, audit.createdBy))
    .where(eq(audit.projectId, projectId))
    .orderBy(desc(audit.createdAt))
    .limit(limit);
}

export async function getAudit(id: string): Promise<Audit | undefined> {
  const [a] = await getDb().select().from(audit).where(eq(audit.id, id));
  return a;
}

/** The audit of the same URL + kind saved just before this one (for "what changed"). */
export async function getPreviousAudit(a: Pick<Audit, "projectId" | "url" | "kind" | "createdAt">): Promise<Audit | undefined> {
  const [prev] = await getDb()
    .select()
    .from(audit)
    .where(and(eq(audit.projectId, a.projectId), eq(audit.url, a.url), eq(audit.kind, a.kind), lt(audit.createdAt, a.createdAt)))
    .orderBy(desc(audit.createdAt))
    .limit(1);
  return prev;
}

export async function deleteAudit(id: string): Promise<void> {
  await getDb().delete(audit).where(eq(audit.id, id));
}
