import { randomBytes } from "node:crypto";

/** Characters for temporary passwords: no look-alikes (0/O, 1/l/I). */
export const TEMP_PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Readable temporary password an admin can read out or paste to someone (16 chars, ~90 bits). */
export function temporaryPassword(length = 16): string {
  // Rejection sampling keeps every character equally likely.
  const out: string[] = [];
  const n = TEMP_PASSWORD_ALPHABET.length;
  const limit = 256 - (256 % n);
  while (out.length < length) {
    for (const b of randomBytes(length * 2)) {
      if (b < limit && out.length < length) out.push(TEMP_PASSWORD_ALPHABET[b % n]);
    }
  }
  return out.join("");
}
