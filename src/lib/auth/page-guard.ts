/** Server-component guards: redirect instead of returning JSON errors. */
import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, isAuthEnabled, type CurrentUser } from "./server";

/** Returns null when sign-in isn't configured (callers render a setup notice). */
export async function requirePageUser(): Promise<CurrentUser | null> {
  if (!isAuthEnabled()) return null;
  const user = await getCurrentUser();
  if (!user || user.status !== "active") redirect("/sign-in");
  return user;
}
