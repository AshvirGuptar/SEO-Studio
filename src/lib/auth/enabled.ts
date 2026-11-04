/** Env-only check (no imports) so it's cheap to call from the proxy. Keep in sync with server.ts. */
export function authEnvConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(
    (env.DATABASE_URL || env.POSTGRES_URL) && env.BETTER_AUTH_SECRET && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET,
  );
}
