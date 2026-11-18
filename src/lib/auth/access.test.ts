import { describe, expect, it } from "vitest";
import { accessConfigFromEnv, canSignUp, decideAccess, parseList, signupDomainsLabel } from "./access";

const cfg = accessConfigFromEnv({ SIGNUP_DOMAINS: "*", ADMIN_EMAILS: "Boss@Acme.com, ops@acme.com", APPROVED_EMAILS: "Prof@uni.edu", AUTO_APPROVE_DOMAINS: "@acme.com,acme.co.uk" });

describe("access config", () => {
  it("parses comma lists, lowercases, strips @", () => {
    expect(parseList(" A@B.com ,, @c.org ")).toEqual(["a@b.com", "c.org"]);
    expect(cfg).toEqual({ signupDomains: [], adminEmails: ["boss@acme.com", "ops@acme.com"], approvedEmails: ["prof@uni.edu"], autoApproveDomains: ["acme.com", "acme.co.uk"] });
  });
});

describe("decideAccess", () => {
  it("lets APPROVED_EMAILS in as members without verification, but respects a disable", () => {
    expect(decideAccess("PROF@uni.edu", cfg)).toEqual({ role: "member", status: "active" });
    expect(decideAccess("prof@uni.edu", cfg, { current: { role: "member", status: "pending" } }).status).toBe("active");
    expect(decideAccess("prof@uni.edu", cfg, { current: { role: "member", status: "disabled" } }).status).toBe("disabled");
    expect(decideAccess("other@uni.edu", cfg).status).toBe("pending");
  });
  it("makes env admins active admins, even if disabled", () => {
    expect(decideAccess("BOSS@acme.com", cfg)).toEqual({ role: "admin", status: "active" });
    expect(decideAccess("boss@acme.com", cfg, { current: { role: "member", status: "disabled" } })).toEqual({ role: "admin", status: "active" });
  });
  it("auto-approves company domains as members only when the email is verified", () => {
    expect(decideAccess("jo@acme.com", cfg, { emailVerified: true })).toEqual({ role: "member", status: "active" });
    expect(decideAccess("jo@sub.acme.com", cfg, { emailVerified: true }).status).toBe("pending");
    // Email + password sign-ups aren't verified: anyone could type an @acme.com address.
    expect(decideAccess("jo@acme.com", cfg)).toEqual({ role: "member", status: "pending" });
    expect(decideAccess("jo@acme.com", cfg, { emailVerified: false }).status).toBe("pending");
  });
  it("still lets env admins and invited people in without verification", () => {
    expect(decideAccess("boss@acme.com", cfg, { emailVerified: false })).toEqual({ role: "admin", status: "active" });
    expect(decideAccess("x@gmail.com", cfg, { emailVerified: false, invite: { role: "member" } }).status).toBe("active");
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

describe("UW-only sign-up (SIGNUP_DOMAINS)", () => {
  const uw = accessConfigFromEnv({ ADMIN_EMAILS: "boss@gmail.com", APPROVED_EMAILS: "prof@gmail.com" }); // default: uw.edu
  it("defaults to uw.edu and lets those addresses in straight away", () => {
    expect(uw.signupDomains).toEqual(["uw.edu"]);
    expect(signupDomainsLabel(uw)).toBe("@uw.edu");
    expect(canSignUp("Student@UW.edu", uw)).toBe(true);
    expect(decideAccess("student@uw.edu", uw)).toEqual({ role: "member", status: "active" });
  });
  it("blocks other domains, including look-alikes, but allows named exceptions", () => {
    expect(canSignUp("x@gmail.com", uw)).toBe(false);
    expect(canSignUp("x@cs.uw.edu", uw)).toBe(false);
    expect(canSignUp("x@uw.edu.evil.com", uw)).toBe(false);
    expect(canSignUp("x@fakeuw.edu", uw)).toBe(false);
    expect(canSignUp("boss@gmail.com", uw)).toBe(true);
    expect(canSignUp("prof@gmail.com", uw)).toBe(true);
    expect(canSignUp("friend@gmail.com", uw, { invited: true })).toBe(true);
  });
  it("still respects a disabled account", () => {
    expect(decideAccess("student@uw.edu", uw, { current: { role: "member", status: "disabled" } }).status).toBe("disabled");
  });
  it('"*" allows anyone (then normal approval applies)', () => {
    const any = accessConfigFromEnv({ SIGNUP_DOMAINS: "*" });
    expect(canSignUp("x@gmail.com", any)).toBe(true);
    expect(decideAccess("x@gmail.com", any).status).toBe("pending");
  });
});
