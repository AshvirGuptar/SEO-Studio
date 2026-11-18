import { createHash, randomBytes } from "node:crypto";

/** Password reset by admin approval (no email): timings and limits. */
export const RESET_LIMITS = {
  /** A request the admin hasn't answered lapses after this. */
  pendingHours: 24,
  /** After approval, the person has this long to pick a new password. */
  approvedHours: 24,
  /** Requests per account per day (stops someone spamming the admin queue). */
  maxPerDay: 3,
} as const;

/** Characters for the confirmation code: no look-alikes (0/O, 1/I/L). */
export const RESET_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomFrom(alphabet: string, length: number): string {
  // Rejection sampling keeps every character equally likely.
  const out: string[] = [];
  const n = alphabet.length;
  const limit = 256 - (256 % n);
  while (out.length < length) {
    for (const b of randomBytes(length * 2)) if (b < limit && out.length < length) out.push(alphabet[b % n]);
  }
  return out.join("");
}

/** Short code the person reads to the admin so the admin knows the request is really theirs. */
export function resetCode(): string {
  return randomFrom(RESET_CODE_ALPHABET, 4);
}

/** Secret kept only in the requesting browser; it's needed to set the new password. */
export function resetToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Only this hash is stored, so a database leak can't be used to finish someone's reset. */
export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
