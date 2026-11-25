import { describe, expect, it } from "vitest";
import { clientIp, retryAfterSec, windowStart } from "./rate-limits";

describe("rate limit helpers", () => {
  it("computes fixed windows and retry-after", () => {
    expect(windowStart(125_000, 60)).toBe(120_000);
    expect(retryAfterSec(125_000, 60)).toBe(55);
    expect(retryAfterSec(179_999, 60)).toBe(1);
  });
  it("takes the first forwarded IP", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(clientIp(new Headers({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
