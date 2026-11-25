import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "../db/test-db";

vi.mock("server-only", () => ({}));

beforeEach(async () => {
  await createTestDb();
  vi.stubEnv("DATABASE_URL", "pglite://memory");
});

describe("rateLimit", () => {
  it("allows up to the limit per IP, then answers 429 with Retry-After", async () => {
    const { rateLimit } = await import("./rate-limit");
    const { RATE_LIMITS } = await import("./rate-limits");
    const req = (ip: string) => new Request("http://x/api/analyze", { headers: { "x-forwarded-for": ip } });
    for (let i = 0; i < RATE_LIMITS.analyze.limit; i++) expect(await rateLimit(req("1.1.1.1"), "analyze")).toBeNull();
    const blocked = await rateLimit(req("1.1.1.1"), "analyze");
    expect(blocked?.status).toBe(429);
    expect(Number(blocked?.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await rateLimit(req("2.2.2.2"), "analyze")).toBeNull(); // other IPs unaffected
  });
});
