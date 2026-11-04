/** Authorization helpers for route handlers. */
import "server-only";
import { getCurrentUser, isAuthEnabled, type CurrentUser } from "./server";
import { publicToolsEnabled } from "./enabled";

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

/** For saved data (projects, audits): sign-in must be configured and the user active. */
export async function requireActiveUser(): Promise<{ user: CurrentUser; error?: undefined } | { user?: undefined; error: Response }> {
  if (!isAuthEnabled()) return deny(503, "Sign-in isn't configured yet, so saving is unavailable.");
  const user = await getCurrentUser();
  if (!user) return deny(401, "Please sign in.");
  if (user.status !== "active") return deny(403, user.status === "pending" ? "Your access request is waiting for an admin." : "Your account is disabled.");
  return { user };
}

export async function requireAdmin(): Promise<{ user: CurrentUser; error?: undefined } | { user?: undefined; error: Response }> {
  const r = await requireActiveUser();
  if (r.error) return r;
  if (r.user.role !== "admin") return deny(403, "Admins only.");
  return r;
}
