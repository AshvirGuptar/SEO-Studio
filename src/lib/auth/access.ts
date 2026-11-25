/**
 * Who gets into SEO & GEO Studio. Pure logic so it's easy to test.
 *
 * Sign-up is limited to SIGNUP_DOMAINS (default "uw.edu"): anyone with an address there can create an
 * account and is approved straight away. Knowing a @uw.edu address is the "key" (deliberately simple;
 * emails aren't verified). "*" allows any address. ADMIN_EMAILS, APPROVED_EMAILS and invited emails
 * may sign up from any domain.
 *
 * Configure with environment variables (comma-separated, case-insensitive):
 *   ADMIN_EMAILS          always admin + active (bootstrap; can't be locked out)
 *   APPROVED_EMAILS       active members as soon as they sign up (a standing invite). An admin can
 *                       still disable them on Team & access.
 *   AUTO_APPROVE_DOMAINS  VERIFIED emails at these domains become active members automatically.
 *                       Email + password sign-ups aren't verified (we can't send email yet), so a
 *                       typed "@uw.edu" address still waits for approval; Google accounts are verified.
 * Everyone else needs an invite from an admin, or lands in "pending" until approved.
 */
export type Role = "admin" | "member" | "client";

/** Clients are read-only and only see the projects they're added to; everyone else can edit. */
export function canEdit(role: Role): boolean {
  return role !== "client";
}
export type Status = "pending" | "active" | "disabled";

/** Used when SIGNUP_DOMAINS isn't set. */
export const DEFAULT_SIGNUP_DOMAINS = ["uw.edu"];

export interface AccessConfig {
  /** Domains allowed to create accounts (approved on sign-up). Empty = any address (then pending). */
  signupDomains: string[];
  adminEmails: string[];
  approvedEmails: string[];
  autoApproveDomains: string[];
}

export function parseList(value: string | undefined): string[] {
  return (value ?? "").split(",").map((s) => s.trim().toLowerCase().replace(/^@/, "")).filter(Boolean);
}

export function accessConfigFromEnv(env: Record<string, string | undefined> = process.env): AccessConfig {
  const domains = env.SIGNUP_DOMAINS === undefined ? DEFAULT_SIGNUP_DOMAINS : parseList(env.SIGNUP_DOMAINS);
  return {
    signupDomains: domains.includes("*") ? [] : domains,
    adminEmails: parseList(env.ADMIN_EMAILS),
    approvedEmails: parseList(env.APPROVED_EMAILS),
    autoApproveDomains: parseList(env.AUTO_APPROVE_DOMAINS),
  };
}

export function emailDomain(email: string): string {
  return email.toLowerCase().split("@").pop() ?? "";
}

/** Whether this address may create an account (checked before the account exists). */
export function canSignUp(email: string, cfg: AccessConfig, opts: { invited?: boolean } = {}): boolean {
  const e = email.trim().toLowerCase();
  if (cfg.signupDomains.length === 0) return true;
  if (opts.invited || cfg.adminEmails.includes(e) || cfg.approvedEmails.includes(e)) return true;
  return cfg.signupDomains.includes(emailDomain(e));
}

/**
 * How the UI names the allowed addresses ("UW" → "your UW email"). The domain itself is never shown.
 * SIGNUP_LABEL overrides it; empty when anyone may sign up.
 */
export function signupLabel(cfg: AccessConfig, env: Record<string, string | undefined> = process.env): string {
  if (cfg.signupDomains.length === 0) return "";
  return env.SIGNUP_LABEL?.trim() || "UW";
}

/**
 * Decide role + status for a user.
 * `current` is the existing account (undefined for a brand-new sign-up); `invite` is a pending invite.
 */
export function decideAccess(
  email: string,
  cfg: AccessConfig,
  opts: { current?: { role: Role; status: Status }; invite?: { role: Role }; emailVerified?: boolean } = {},
): { role: Role; status: Status } {
  const e = email.toLowerCase();
  if (cfg.adminEmails.includes(e)) return { role: "admin", status: "active" };

  const { current, invite } = opts;
  if (current?.status === "disabled") return current; // only an admin can re-enable
  if (current?.status === "active") return current;

  if (invite) return { role: invite.role, status: "active" };
  if (cfg.approvedEmails.includes(e)) return { role: current?.role ?? "member", status: "active" };
  // Allowed sign-up domain (e.g. @uw.edu): approved straight away.
  if (cfg.signupDomains.includes(emailDomain(e))) return { role: current?.role ?? "member", status: "active" };
  // Only trust the domain when the email address is proven (e.g. Google sign-in); anyone can type one.
  if (opts.emailVerified && cfg.autoApproveDomains.includes(emailDomain(e))) return { role: current?.role ?? "member", status: "active" };
  return { role: current?.role ?? "member", status: "pending" };
}
