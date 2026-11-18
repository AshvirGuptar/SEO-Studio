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

export type PremiumAccess =
  | { user: CurrentUser; gate?: undefined }
  | { user?: undefined; gate: "signin" | "pending" | "disabled" | "setup" };

/**
 * For premium (Claude API) tool pages. Never redirects: signed-out or not-yet-approved visitors get
 * a `gate` reason so the page can explain and offer sign-in / request access.
 */
export async function premiumPageAccess(): Promise<PremiumAccess> {
  if (!isAuthEnabled()) return openModeEnabled() ? { user: await openModeUser() } : { gate: "setup" };
  const user = await getCurrentUser();
  if (!user) return { gate: "signin" };
  if (user.status === "pending") return { gate: "pending" };
  if (user.status === "disabled") return { gate: "disabled" };
  return { user };
}
