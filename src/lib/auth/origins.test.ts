import { describe, expect, it } from "vitest";
import { authBaseURL, authTrustedOrigins } from "./origins";

const vercel = {
  VERCEL_ENV: "production",
  VERCEL_PROJECT_PRODUCTION_URL: "seo-studio-weld.vercel.app",
  VERCEL_URL: "seo-studio-abc123-team.vercel.app",
  VERCEL_BRANCH_URL: "seo-studio-git-main-team.vercel.app",
};

describe("auth origins", () => {
  it("uses the production domain by default and trusts all of the project's Vercel addresses", () => {
    expect(authBaseURL(vercel)).toBe("https://seo-studio-weld.vercel.app");
    expect(authTrustedOrigins(vercel)).toEqual([
      "https://seo-studio-weld.vercel.app",
      "https://seo-studio-abc123-team.vercel.app",
      "https://seo-studio-git-main-team.vercel.app",
    ]);
  });
  it("respects BETTER_AUTH_URL (trailing slash, path ignored) and still trusts Vercel addresses", () => {
    const env = { ...vercel, BETTER_AUTH_URL: "https://studio.example.com/" };
    expect(authBaseURL(env)).toBe("https://studio.example.com");
    expect(authTrustedOrigins(env)).toContain("https://seo-studio-weld.vercel.app");
    expect(authTrustedOrigins(env)[0]).toBe("https://studio.example.com");
  });
  it("keeps preview deployments on their own address", () => {
    const env = { ...vercel, VERCEL_ENV: "preview", VERCEL_BRANCH_URL: "seo-studio-git-feature-team.vercel.app" };
    expect(authBaseURL(env)).toBe("https://seo-studio-git-feature-team.vercel.app");
  });
  it("adds TRUSTED_ORIGINS and skips junk", () => {
    expect(authTrustedOrigins({ TRUSTED_ORIGINS: "https://a.com, b.org ,, ::bad::" })).toEqual(["https://a.com", "https://b.org"]);
    expect(authBaseURL({})).toBeUndefined();
  });
});
