import { describe, expect, it } from "vitest";
import { authEnvConfigured, dataEnabled, emailEnvConfigured, googleSignInConfigured, isPremiumToolPath, isPublicToolPath, openModeEnabled, PREMIUM_TOOL_PATHS, publicToolsEnabled } from "./enabled";

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
    expect(publicToolsEnabled({})).toBe(true); // free tools are public by default
    expect(publicToolsEnabled({ PUBLIC_TOOLS: "off" })).toBe(false);
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

describe("premium tools", () => {
  it("PREMIUM_TOOL_PATHS matches the premium tools in nav.ts", async () => {
    const { TOOLS } = await import("@/components/nav");
    expect([...PREMIUM_TOOL_PATHS].sort()).toEqual(TOOLS.filter((t) => t.premium).map((t) => t.href).sort());
  });
  it("matches premium pages but never their APIs or free tools", () => {
    expect(isPremiumToolPath("/ai-visibility")).toBe(true);
    expect(isPremiumToolPath("/api/visibility/runs/x/next")).toBe(false);
    expect(isPremiumToolPath("/analyzer")).toBe(false);
  });
});

describe("email", () => {
  it("needs both SMTP_USER and SMTP_PASSWORD", () => {
    expect(emailEnvConfigured({ SMTP_USER: "a@gmail.com", SMTP_PASSWORD: "x" })).toBe(true);
    expect(emailEnvConfigured({ SMTP_USER: "a@gmail.com" })).toBe(false);
    expect(emailEnvConfigured({})).toBe(false);
  });
});

describe("tool registry stays in sync", () => {
  it("every free live tool in nav.ts is public; data and premium tools are not", async () => {
    const { TOOLS } = await import("@/components/nav");
    for (const t of TOOLS) {
      const free = t.status === "live" && !t.premium && !t.needsAuth;
      expect(isPublicToolPath(t.href), `${t.href} public?`).toBe(free);
    }
  });
});
