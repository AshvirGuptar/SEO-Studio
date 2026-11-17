/** Server-component guards: redirect instead of returning JSON errors. */
import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, isAuthEnabled, type CurrentUser } from "./server";
import { openModeEnabled } from "./enabled";
import { openModeUser } from "./open-mode";

/**
 * The user for pages with saved data. In open mode (database, no sign-in) that's the shared Team
 * user. Returns null when neither sign-in nor a database is configured (callers render a setup notice).
 */
export async function requirePageUser(): Promise<CurrentUser | null> {
  if (!isAuthEnabled()) return openModeEnabled() ? openModeUser() : null;
  const user = await getCurrentUser();
  if (!user || user.status !== "active") redirect("/sign-in");
  return user;
}
