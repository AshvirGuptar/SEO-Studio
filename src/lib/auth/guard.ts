/** Authorization helpers for route handlers. */
import "server-only";
import { getCurrentUser, isAuthEnabled, type CurrentUser } from "./server";
import { openModeEnabled, publicToolsEnabled } from "./enabled";
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
  if (!isAuthEnabled()) return deny(503, "Team & access needs Google sign-in to be set up.");
  const r = await requireActiveUser();
  if (r.error) return r;
  if (r.user.role !== "admin") return deny(403, "Admins only.");
  return r;
}
