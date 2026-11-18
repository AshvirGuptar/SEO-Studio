import { describe, expect, it } from "vitest";
import { hashResetToken, RESET_CODE_ALPHABET, resetCode, resetToken } from "./password";

describe("password reset secrets", () => {
  it("codes are 4 readable characters", () => {
    const c = resetCode();
    expect(c).toHaveLength(4);
    for (const ch of c) expect(RESET_CODE_ALPHABET).toContain(ch);
  });
  it("tokens are long, unique and hashed deterministically", () => {
    const t = resetToken();
    expect(t.length).toBeGreaterThanOrEqual(43);
    expect(new Set(Array.from({ length: 50 }, resetToken)).size).toBe(50);
    expect(hashResetToken(t)).toBe(hashResetToken(t));
    expect(hashResetToken(t)).not.toBe(t);
  });
});
