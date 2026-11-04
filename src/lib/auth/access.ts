/**
 * Who gets into SEO Studio. Pure logic so it's easy to test.
 *
 * Configure with environment variables (comma-separated, case-insensitive):
 *   ADMIN_EMAILS          always admin + active (bootstrap; can't be locked out)
 *   AUTO_APPROVE_DOMAINS  emails at these domains become active members automatically
 * Everyone else needs an invite from an admin, or lands in "pending" until approved.
 */
export type Role = "admin" | "member";
export type Status = "pending" | "active" | "disabled";

export interface AccessConfig {
  adminEmails: string[];
  autoApproveDomains: string[];
}

export function parseList(value: string | undefined): string[] {
  return (value ?? "").split(",").map((s) => s.trim().toLowerCase().replace(/^@/, "")).filter(Boolean);
}

export function accessConfigFromEnv(env: Record<string, string | undefined> = process.env): AccessConfig {
  return { adminEmails: parseList(env.ADMIN_EMAILS), autoApproveDomains: parseList(env.AUTO_APPROVE_DOMAINS) };
}

export function emailDomain(email: string): string {
  return email.toLowerCase().split("@").pop() ?? "";
}

/**
 * Decide role + status for a user.
 * `current` is the existing account (undefined for a brand-new sign-up); `invite` is a pending invite.
 */
export function decideAccess(
  email: string,
  cfg: AccessConfig,
  opts: { current?: { role: Role; status: Status }; invite?: { role: Role } } = {},
): { role: Role; status: Status } {
  const e = email.toLowerCase();
  if (cfg.adminEmails.includes(e)) return { role: "admin", status: "active" };

  const { current, invite } = opts;
  if (current?.status === "disabled") return current; // only an admin can re-enable
  if (current?.status === "active") return current;

  if (invite) return { role: invite.role, status: "active" };
  if (cfg.autoApproveDomains.includes(emailDomain(e))) return { role: current?.role ?? "member", status: "active" };
  return { role: current?.role ?? "member", status: "pending" };
}
