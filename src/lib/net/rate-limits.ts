/**
 * Request limits for the public tool APIs (pure: config + window math + client IP parsing).
 * Counted per IP in fixed windows; see rate-limit.ts for the database side.
 */
export const RATE_LIMITS = {
  /** Page Analyzer: one full audit per request. */
  analyze: { limit: 20, windowSec: 60 },
  /** Site Audit start: robots.txt + sitemaps. */
  discover: { limit: 10, windowSec: 60 },
  /** Site Audit pages: a crawl sends a few per second, so this is generous. */
  auditPage: { limit: 300, windowSec: 60 },
  /** AI rewrite (also capped by the AI budget). */
  aiRewrite: { limit: 10, windowSec: 60 },
} as const;

export type RateBucket = keyof typeof RATE_LIMITS;

/** Start (ms) of the fixed window `now` falls in. */
export function windowStart(now: number, windowSec: number): number {
  const w = windowSec * 1000;
  return Math.floor(now / w) * w;
}

/** Seconds until the current window ends (for Retry-After). */
export function retryAfterSec(now: number, windowSec: number): number {
  return Math.max(1, Math.ceil((windowStart(now, windowSec) + windowSec * 1000 - now) / 1000));
}

/** The caller's IP from proxy headers (Vercel sets x-forwarded-for; first entry is the client). */
export function clientIp(headers: Pick<Headers, "get">): string {
  const fwd = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = fwd || headers.get("x-real-ip")?.trim() || "unknown";
  return ip.slice(0, 64);
}
