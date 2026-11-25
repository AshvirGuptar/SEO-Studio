/** Database-backed request limits for the public tool APIs (server-only). */
import "server-only";
import { sql } from "drizzle-orm";
import { databaseUrl, getDb } from "@/lib/db";
import { apiRate } from "@/lib/db/schema";
import { clientIp, RATE_LIMITS, retryAfterSec, windowStart, type RateBucket } from "./rate-limits";

/**
 * Counts this request and returns a 429 Response when the caller is over the limit, else null.
 * Without a database (or if the counter fails) requests are allowed, so tools keep working.
 */
export async function rateLimit(request: Request, bucket: RateBucket, who?: string): Promise<Response | null> {
  if (!databaseUrl()) return null;
  const { limit, windowSec } = RATE_LIMITS[bucket];
  const now = Date.now();
  const start = windowStart(now, windowSec);
  const key = `${bucket}:${who ?? clientIp(request.headers)}`;
  try {
    const [row] = await getDb()
      .insert(apiRate)
      .values({ key, windowStart: start, count: 1 })
      .onConflictDoUpdate({
        target: apiRate.key,
        set: {
          count: sql`case when ${apiRate.windowStart} = ${start} then ${apiRate.count} + 1 else 1 end`,
          windowStart: start,
        },
      })
      .returning({ count: apiRate.count });
    if (row && row.count > limit) {
      const retry = retryAfterSec(now, windowSec);
      return Response.json(
        { error: `Too many requests. Please wait ${retry} seconds and try again.` },
        { status: 429, headers: { "Retry-After": String(retry) } },
      );
    }
  } catch (e) {
    console.error("[rate-limit]", e);
  }
  return null;
}
