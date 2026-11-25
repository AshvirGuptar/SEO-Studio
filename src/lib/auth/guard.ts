/** Authorization helpers for route handlers. */
import "server-only";
import { getCurrentUser, isAuthEnabled, type CurrentUser } from "./server";
import { openModeEnabled, publicToolsEnabled } from "./enabled";
import { canEdit } from "./access";
import { canViewProject } from "@/lib/db/repo";
import { openModeUser } from "./open-mode";

type Result = { user: CurrentUser | null; error?: undefined } | { user?: undefined; error: Response };

const deny = (status: number, error: string) => ({ error: Response.json({ error }, { status }) });

/**
 * For the SEO tools: when sign-in is enabled, require an active user; when it isn't
 * configured, the tools stay open (user = null).
 */
export async function requireToolAccess(): Promise<Result> {
  if (!isAuthEnabled() || publicToolsEnabled()) return { user: null };
  return requireActiveUser();
}

/**
 * For saved data (projects, audits, AI Visibility): an active signed-in user, or — in open mode
 * (database connected, sign-in not set up) — the shared Team user.
 */
export async function requireActiveUser(): Promise<{ user: CurrentUser; error?: undefined } | { user?: undefined; error: Response }> {
  if (!isAuthEnabled()) {
    if (openModeEnabled()) return { user: await openModeUser() };
    return deny(503, "Saving needs a database. An admin connects one in Vercel (Storage → Neon).");
  }
  const user = await getCurrentUser();
  if (!user) return deny(401, "Please sign in.");
  if (user.status !== "active") return deny(403, user.status === "pending" ? "Your access request is waiting for an admin." : "Your account is disabled.");
  return { user };
}

/** Team & access needs real sign-in; it's off in open mode. */
export async function requireAdmin(): Promise<{ user: CurrentUser; error?: undefined } | { user?: undefined; error: Response }> {
  if (!isAuthEnabled()) return deny(503, "Team & access needs accounts to be turned on (BETTER_AUTH_SECRET in Vercel).");
  const r = await requireActiveUser();
  if (r.error) return r;
  if (r.user.role !== "admin") return deny(403, "Admins only.");
  return r;
}

/** Saved-data changes (create, save, run AI, delete): any active user except read-only clients. */
export async function requireEditor(): Promise<{ user: CurrentUser; error?: undefined } | { user?: undefined; error: Response }> {
  const r = await requireActiveUser();
  if (r.error) return r;
  if (!canEdit(r.user.role)) return deny(403, "Your account has read-only access.");
  return r;
}

/** Reading one project's data: clients only for projects they were added to (404 otherwise). */
export async function requireProjectView(projectId: string): Promise<{ user: CurrentUser; error?: undefined } | { user?: undefined; error: Response }> {
  const r = await requireActiveUser();
  if (r.error) return r;
  if (!(await canViewProject(r.user, projectId))) return deny(404, "Project not found.");
  return r;
}
