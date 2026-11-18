/** Env-only checks (no imports) so they're cheap to call from the proxy. Keep in sync with server.ts. */

/**
 * Accounts (email + password sign-up, optional Google) are ON when a database and BETTER_AUTH_SECRET
 * are set. Google sign-in is an optional extra on top (see googleSignInConfigured).
 */
export function authEnvConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean((env.DATABASE_URL || env.POSTGRES_URL) && env.BETTER_AUTH_SECRET);
}

/** "Continue with Google" is offered only when a Google OAuth client is configured. */
export function googleSignInConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

/**
 * Open mode: a database is connected but accounts aren't set up yet (no BETTER_AUTH_SECRET). Everyone who can reach the
 * site acts as one shared "Team" user, so saving, Projects and AI Visibility work without logging in.
 * Team & access stays off. It ends automatically once BETTER_AUTH_SECRET is set.
 */
export function openModeEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return !authEnvConfigured(env) && Boolean(env.DATABASE_URL || env.POSTGRES_URL);
}

/** Saved data (projects, audits, AI Visibility) is available: real sign-in or open mode. */
export function dataEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return authEnvConfigured(env) || openModeEnabled(env);
}

/**
 * Demo / public-tools mode: PUBLIC_TOOLS=true lets anyone use the analysis tools without signing in.
 * Saved data (projects, audits) and Team & access ALWAYS still require an approved account.
 */
export function publicToolsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return /^(1|true|yes|on)$/i.test(env.PUBLIC_TOOLS ?? "");
}

/** Pages and APIs that become public when PUBLIC_TOOLS is on. Everything else stays behind sign-in. */
export const PUBLIC_TOOL_PATHS = ["/", "/analyzer", "/content", "/urls", "/audit", "/keywords", "/guide", "/api/analyze", "/api/audit"];

export function isPublicToolPath(pathname: string): boolean {
  return PUBLIC_TOOL_PATHS.some((p) => (p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(`${p}/`)));
}
