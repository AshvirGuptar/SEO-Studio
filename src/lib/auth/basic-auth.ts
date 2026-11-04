/**
 * Temporary site-wide password gate (HTTP Basic Auth) until Phase 1 adds real team sign-in.
 * Enabled only when SITE_PASSWORD is set, so local dev stays open.
 */
import { timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Returns true if the Authorization header carries the expected credentials. */
export function checkBasicAuth(header: string | null, expectedUser: string, expectedPassword: string): boolean {
  if (!header?.startsWith("Basic ")) return false;
  let decoded: string;
  try {
    decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  } catch {
    return false;
  }
  const i = decoded.indexOf(":");
  if (i < 0) return false;
  // Evaluate both comparisons so timing doesn't reveal which part was wrong.
  const userOk = safeEqual(decoded.slice(0, i), expectedUser);
  const passOk = safeEqual(decoded.slice(i + 1), expectedPassword);
  return userOk && passOk;
}
