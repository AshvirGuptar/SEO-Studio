/** The shared "Team" user everyone acts as in open mode (database connected, no sign-in). */
import "server-only";
import { connection } from "next/server";
import { ensureOpenModeUser } from "@/lib/db/repo";
import type { CurrentUser } from "./server";

let ready: Promise<CurrentUser> | null = null;

/**
 * Pages using this read the database, so they must render per request, never at build time
 * (open mode reads no cookies, which would otherwise make Next prerender them).
 */
export async function openModeUser(): Promise<CurrentUser> {
  await connection();
  ready ??= ensureOpenModeUser()
    .then((u) => ({ id: u.id, name: u.name, email: u.email, image: null, role: u.role, status: u.status }))
    .catch((e) => {
      ready = null; // retry on the next request (e.g. the database was briefly unreachable)
      throw e;
    });
  return ready;
}
