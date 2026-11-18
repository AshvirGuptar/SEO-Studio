/**
 * Which web addresses Better Auth accepts requests from (pure, env-only). Vercel serves one project
 * on several addresses (production domain, git-branch alias, per-deployment URL), and a request
 * from any address not listed fails with "Invalid origin".
 */
type Env = Record<string, string | undefined>;

function toOrigin(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  const v = value.trim();
  try {
    return new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`).origin;
  } catch {
    return null;
  }
}

/** The app's own public address: links in emails point here. */
export function authBaseURL(env: Env = process.env): string | undefined {
  const explicit = toOrigin(env.BETTER_AUTH_URL);
  if (explicit) return explicit;
  // On preview deployments, keep links on the preview so testing a PR doesn't touch production.
  if (env.VERCEL_ENV === "preview") return toOrigin(env.VERCEL_BRANCH_URL) ?? toOrigin(env.VERCEL_URL) ?? undefined;
  return toOrigin(env.VERCEL_PROJECT_PRODUCTION_URL) ?? undefined;
}

/**
 * Every address of THIS project that may call the auth API: the base URL, the production domain,
 * this deployment's own URL and its branch alias, plus TRUSTED_ORIGINS (comma-separated, e.g. a
 * custom domain added later).
 */
export function authTrustedOrigins(env: Env = process.env): string[] {
  const list = [
    authBaseURL(env),
    env.BETTER_AUTH_URL,
    env.VERCEL_PROJECT_PRODUCTION_URL,
    env.VERCEL_URL,
    env.VERCEL_BRANCH_URL,
    ...(env.TRUSTED_ORIGINS ?? "").split(","),
  ].map(toOrigin).filter((o): o is string => Boolean(o));
  return [...new Set(list)];
}

/**
 * The address this request was sent to (from Host / X-Forwarded-Host). A browser request whose
 * Origin equals its own host is same-site, so trusting it can't open a cross-site hole: another
 * website's requests carry that website's Origin and are still rejected.
 */
export function requestOwnOrigin(headers: Pick<Headers, "get"> | undefined): string | null {
  if (!headers) return null;
  const host = (headers.get("x-forwarded-host") ?? headers.get("host") ?? "").split(",")[0].trim();
  if (!host || !/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return null;
  const proto = (headers.get("x-forwarded-proto") ?? "").split(",")[0].trim().toLowerCase();
  return `${proto === "http" ? "http" : host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https"}://${host.toLowerCase()}`;
}
