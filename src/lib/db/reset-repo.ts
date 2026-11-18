/** Password reset requests approved by an admin (see passwordReset in schema.ts). */
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { getDb } from "./index";
import { passwordReset, user } from "./schema";
import { hashResetToken, RESET_LIMITS, resetCode, resetToken } from "../auth/password";

const HOUR = 3_600_000;

export type ResetStatus = "pending" | "approved" | "denied" | "used" | "expired";

/**
 * Start a reset for an email. Returns null when there's no usable account (the route still answers
 * as if it worked, so nobody can probe which emails have accounts), or "limited" after too many.
 * A new request replaces the person's earlier unanswered one.
 */
export async function createResetRequest(email: string): Promise<{ token: string; code: string } | "limited" | null> {
  const db = getDb();
  const [u] = await db.select().from(user).where(eq(user.email, email.trim().toLowerCase()));
  if (!u || u.status === "disabled") return null;
  const since = new Date(Date.now() - 24 * HOUR);
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(passwordReset)
    .where(and(eq(passwordReset.userId, u.id), gt(passwordReset.createdAt, since)));
  if (n >= RESET_LIMITS.maxPerDay) return "limited";
  await db.update(passwordReset).set({ status: "denied", decidedAt: new Date() })
    .where(and(eq(passwordReset.userId, u.id), eq(passwordReset.status, "pending")));
  const token = resetToken();
  const code = resetCode();
  await db.insert(passwordReset).values({
    id: crypto.randomUUID(), userId: u.id, tokenHash: hashResetToken(token), code,
    expiresAt: new Date(Date.now() + RESET_LIMITS.pendingHours * HOUR),
  });
  return { token, code };
}

/** Status for the requesting browser. Unknown tokens look "pending" (see createResetRequest). */
export async function getResetStatus(token: string): Promise<ResetStatus> {
  const [r] = await getDb().select().from(passwordReset).where(eq(passwordReset.tokenHash, hashResetToken(token)));
  if (!r) return "pending";
  if ((r.status === "pending" || r.status === "approved") && r.expiresAt.getTime() <= Date.now()) return "expired";
  return r.status;
}

export interface PendingReset { id: string; userId: string; name: string; email: string; code: string; createdAt: Date }

export async function listPendingResets(): Promise<PendingReset[]> {
  return getDb()
    .select({ id: passwordReset.id, userId: user.id, name: user.name, email: user.email, code: passwordReset.code, createdAt: passwordReset.createdAt })
    .from(passwordReset).innerJoin(user, eq(user.id, passwordReset.userId))
    .where(and(eq(passwordReset.status, "pending"), gt(passwordReset.expiresAt, new Date())))
    .orderBy(desc(passwordReset.createdAt));
}

/** Approve or deny a pending request. Admins can't approve their own. */
export async function decideReset(id: string, approve: boolean, adminId: string): Promise<"ok" | "not-found" | "own"> {
  const db = getDb();
  const [r] = await db.select().from(passwordReset).where(and(eq(passwordReset.id, id), eq(passwordReset.status, "pending"), gt(passwordReset.expiresAt, new Date())));
  if (!r) return "not-found";
  if (approve && r.userId === adminId) return "own";
  await db.update(passwordReset).set({
    status: approve ? "approved" : "denied", decidedAt: new Date(), decidedBy: adminId,
    ...(approve ? { expiresAt: new Date(Date.now() + RESET_LIMITS.approvedHours * HOUR) } : {}),
  }).where(and(eq(passwordReset.id, id), eq(passwordReset.status, "pending")));
  return "ok";
}

/** Use an approved request exactly once (atomic). Returns the account to update, or null. */
export async function consumeReset(token: string): Promise<{ userId: string; email: string } | null> {
  const db = getDb();
  const [r] = await db.update(passwordReset).set({ status: "used" })
    .where(and(eq(passwordReset.tokenHash, hashResetToken(token)), eq(passwordReset.status, "approved"), gt(passwordReset.expiresAt, new Date())))
    .returning({ userId: passwordReset.userId });
  if (!r) return null;
  const [u] = await db.select({ email: user.email, status: user.status }).from(user).where(eq(user.id, r.userId));
  if (!u || u.status === "disabled") return null;
  return { userId: r.userId, email: u.email };
}
