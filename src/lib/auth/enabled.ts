/** Env-only checks (no imports) so they're cheap to call from the proxy. Keep in sync with server.ts. */
export function authEnvConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(
    (env.DATABASE_URL || env.POSTGRES_URL) && env.BETTER_AUTH_SECRET && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET,
  );
}

/**
 * Demo / open mode: PUBLIC_TOOLS=true lets anyone use the analysis tools without signing in.
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
