import { describe, expect, it } from "vitest";
import { resetPasswordEmail } from "./templates";

describe("resetPasswordEmail", () => {
  it("includes the link and expiry in both versions", () => {
    const e = resetPasswordEmail({ name: "Pat", url: "https://x.app/api/auth/reset-password/abc?callbackURL=%2Freset-password", minutes: 60 });
    expect(e.subject).toMatch(/Reset your .* password/);
    expect(e.text).toContain("https://x.app/api/auth/reset-password/abc?callbackURL=%2Freset-password");
    expect(e.text).toContain("60 minutes");
    expect(e.html).toContain("Hi Pat,");
    expect(e.html).toContain("callbackURL=%2Freset-password");
  });
  it("escapes names so they can't inject HTML", () => {
    const e = resetPasswordEmail({ name: "<img src=x onerror=alert(1)>", url: "https://x.app/r?a=1&b=2", minutes: 60 });
    expect(e.html).not.toContain("<img");
    expect(e.html).toContain("&lt;img");
    expect(e.html).toContain("a=1&amp;b=2");
  });
});
