import { describe, expect, it } from "vitest";
import { accessConfigFromEnv, decideAccess, parseList } from "./access";

const cfg = accessConfigFromEnv({ ADMIN_EMAILS: "Boss@Acme.com, ops@acme.com", AUTO_APPROVE_DOMAINS: "@acme.com,acme.co.uk" });

describe("access config", () => {
  it("parses comma lists, lowercases, strips @", () => {
    expect(parseList(" A@B.com ,, @c.org ")).toEqual(["a@b.com", "c.org"]);
    expect(cfg).toEqual({ adminEmails: ["boss@acme.com", "ops@acme.com"], autoApproveDomains: ["acme.com", "acme.co.uk"] });
  });
});

describe("decideAccess", () => {
  it("makes env admins active admins, even if disabled", () => {
    expect(decideAccess("BOSS@acme.com", cfg)).toEqual({ role: "admin", status: "active" });
    expect(decideAccess("boss@acme.com", cfg, { current: { role: "member", status: "disabled" } })).toEqual({ role: "admin", status: "active" });
  });
  it("auto-approves company domains as members", () => {
    expect(decideAccess("jo@acme.com", cfg)).toEqual({ role: "member", status: "active" });
    expect(decideAccess("jo@sub.acme.com", cfg).status).toBe("pending");
  });
  it("activates invited outsiders with the invited role", () => {
    expect(decideAccess("freelancer@gmail.com", cfg, { invite: { role: "admin" } })).toEqual({ role: "admin", status: "active" });
  });
  it("leaves uninvited outsiders pending", () => {
    expect(decideAccess("stranger@gmail.com", cfg)).toEqual({ role: "member", status: "pending" });
  });
  it("activates a pending user once invited, but never re-enables a disabled one", () => {
    expect(decideAccess("x@gmail.com", cfg, { current: { role: "member", status: "pending" }, invite: { role: "member" } }).status).toBe("active");
    expect(decideAccess("x@acme.com", cfg, { current: { role: "member", status: "disabled" } }).status).toBe("disabled");
  });
  it("keeps an active user's role", () => {
    expect(decideAccess("x@gmail.com", cfg, { current: { role: "admin", status: "active" } })).toEqual({ role: "admin", status: "active" });
  });
});
