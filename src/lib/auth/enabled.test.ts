import { describe, expect, it } from "vitest";
import { authEnvConfigured, dataEnabled, googleSignInConfigured, isPublicToolPath, openModeEnabled, publicToolsEnabled } from "./enabled";

describe("open mode", () => {
  const signIn = { BETTER_AUTH_SECRET: "s", GOOGLE_CLIENT_ID: "i", GOOGLE_CLIENT_SECRET: "c" };
  it("is on with a database and no sign-in, off once sign-in is set up", () => {
    expect(openModeEnabled({ DATABASE_URL: "postgres://x" })).toBe(true);
    expect(openModeEnabled({ POSTGRES_URL: "postgres://x" })).toBe(true);
    expect(openModeEnabled({})).toBe(false);
    expect(openModeEnabled({ DATABASE_URL: "postgres://x", ...signIn })).toBe(false);
  });
  it("has saved data with sign-in or open mode, not without a database", () => {
    expect(dataEnabled({ DATABASE_URL: "postgres://x" })).toBe(true);
    expect(dataEnabled({ DATABASE_URL: "postgres://x", ...signIn })).toBe(true);
    expect(dataEnabled({})).toBe(false);
  });
});

describe("demo mode", () => {
  it("parses PUBLIC_TOOLS", () => {
    expect(publicToolsEnabled({ PUBLIC_TOOLS: "true" })).toBe(true);
    expect(publicToolsEnabled({ PUBLIC_TOOLS: "1" })).toBe(true);
    expect(publicToolsEnabled({ PUBLIC_TOOLS: "false" })).toBe(false);
    expect(publicToolsEnabled({})).toBe(false);
  });
  it("opens only the tools, never saved data or admin", () => {
    for (const p of ["/", "/analyzer", "/audit", "/api/analyze", "/api/audit/page", "/guide"]) expect(isPublicToolPath(p)).toBe(true);
    for (const p of ["/projects", "/projects/x", "/admin", "/api/projects", "/api/admin/users", "/api/audits/x", "/analyzerx"]) expect(isPublicToolPath(p)).toBe(false);
  });
});

describe("accounts", () => {
  it("turn on with a database and BETTER_AUTH_SECRET; Google is optional", () => {
    expect(authEnvConfigured({ DATABASE_URL: "postgres://x", BETTER_AUTH_SECRET: "s" })).toBe(true);
    expect(authEnvConfigured({ DATABASE_URL: "postgres://x" })).toBe(false);
    expect(authEnvConfigured({ BETTER_AUTH_SECRET: "s" })).toBe(false);
    expect(openModeEnabled({ DATABASE_URL: "postgres://x", BETTER_AUTH_SECRET: "s" })).toBe(false);
    expect(googleSignInConfigured({ GOOGLE_CLIENT_ID: "i", GOOGLE_CLIENT_SECRET: "c" })).toBe(true);
    expect(googleSignInConfigured({ GOOGLE_CLIENT_ID: "i" })).toBe(false);
  });
});
