import { describe, expect, it } from "vitest";
import { isPrivateAddress, normalizeInputUrl } from "./fetch-page";

describe("SSRF guards", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "0.0.0.0", "::1", "fd00::1", "::ffff:127.0.0.1", "100.64.0.1"])(
    "treats %s as private", (ip) => expect(isPrivateAddress(ip)).toBe(true),
  );
  it.each(["8.8.8.8", "93.184.216.34", "2606:4700::1111"])("treats %s as public", (ip) => expect(isPrivateAddress(ip)).toBe(false));

  it("adds https:// to bare domains and rejects other protocols", () => {
    expect(normalizeInputUrl("example.com/x").href).toBe("https://example.com/x");
    expect(() => normalizeInputUrl("file:///etc/passwd")).toThrow();
    expect(() => normalizeInputUrl("https://user:pw@example.com")).toThrow();
  });
});
