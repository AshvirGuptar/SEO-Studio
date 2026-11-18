import { describe, expect, it } from "vitest";
import { TEMP_PASSWORD_ALPHABET, temporaryPassword } from "./password";

describe("temporaryPassword", () => {
  it("is 16 characters from the readable alphabet", () => {
    const p = temporaryPassword();
    expect(p).toHaveLength(16);
    for (const ch of p) expect(TEMP_PASSWORD_ALPHABET).toContain(ch);
  });
  it("is different every time", () => {
    expect(new Set(Array.from({ length: 50 }, () => temporaryPassword())).size).toBe(50);
  });
});
