/**
 * Better Auth setup: email + password accounts (plus optional Google), users stored in Postgres,
 * invite/approval-based access (see access.ts).
 *
 * Accounts are ENABLED when DATABASE_URL and BETTER_AUTH_SECRET are set; with only a database the
 * app runs in open mode (shared Team user). Optional: GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET (adds
 * "Continue with Google"), BETTER_AUTH_URL (defaults to the Vercel production URL), ADMIN_EMAILS,
 * AUTO_APPROVE_DOMAINS (verified emails only).
 */
import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { cache } from "react";
import { getDb, schema } from "@/lib/db";
import { authEnvConfigured, googleSignInConfigured } from "./enabled";
import { authBaseURL, authTrustedOrigins } from "./origins";
import { accessConfigFromEnv, decideAccess, type Role, type Status } from "./access";
import { applyAccessOnSignIn, getInvite } from "@/lib/db/repo";
import { isEmailEnabled, sendEmail } from "@/lib/email/send";
import { resetPasswordEmail } from "@/lib/email/templates";

/** Password-reset links (emailed) stay valid this long. */
export const RESET_LINK_MINUTES = 60;

export function isAuthEnabled(): boolean {
  return authEnvConfigured();
}

export { isEmailEnabled };

export function isGoogleEnabled(): boolean {
  return authEnvConfigured() && googleSignInConfigured();
}

function createAuth() {
  return betterAuth({
    baseURL: authBaseURL(),
    trustedOrigins: authTrustedOrigins(),
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_LIMITS.min,
      maxPasswordLength: PASSWORD_LIMITS.max,
      autoSignIn: true, // signed in right after creating an account (then approval decides access)
      // "Forgot password?" emails a one-time link when SMTP is configured; otherwise the sign-in page
      // uses the admin-approved reset flow instead (lib/db/reset-repo.ts).
      ...(isEmailEnabled()
        ? {
            sendResetPassword: async ({ user, url }: { user: { email: string; name: string }; url: string }) => {
              await sendEmail(user.email, resetPasswordEmail({ name: user.name, url, minutes: RESET_LINK_MINUTES }));
            },
            resetPasswordTokenExpiresIn: RESET_LINK_MINUTES * 60,
            revokeSessionsOnPasswordReset: true,
          }
        : {}),
    },
    socialProviders: googleSignInConfigured()
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID ?? "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
            prompt: "select_account",
          },
        }
      : {},
    // Slow down password guessing and sign-up spam. Stored in Postgres so the limit holds across
    // Vercel's serverless instances (in-memory counters would reset per instance).
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60 * 10, max: 5 },
        "/change-password": { window: 60, max: 5 },
        "/request-password-reset": { window: 60 * 10, max: 3 },
        "/reset-password": { window: 60 * 10, max: 10 },
      },
    },
    user: {
      additionalFields: {
        role: { type: "string", required: false, defaultValue: "member", input: false },
        status: { type: "string", required: false, defaultValue: "pending", input: false },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 14, // 14 days
      updateAge: 60 * 60 * 24, // refresh daily
    },
    databaseHooks: {
      user: {
        create: {
          // New account: decide role/status from env config + invites.
          before: async (u) => {
            const inv = await getInvite(u.email);
            const access = decideAccess(u.email, accessConfigFromEnv(), { invite: inv, emailVerified: u.emailVerified });
            return { data: { ...u, ...access } };
          },
        },
      },
      session: {
        create: {
          // Every sign-in: pick up invites / config changes made since the account was created.
          after: async (s) => {
            await applyAccessOnSignIn(s.userId);
          },
        },
      },
    },
    plugins: [nextCookies()],
  });
}

/** Password length rules, shared with the sign-up form. */
export const PASSWORD_LIMITS = { min: 8, max: 128 } as const;

type Auth = ReturnType<typeof createAuth>;
let instance: Auth | null = null;

export function getAuth(): Auth {
  if (!isAuthEnabled()) throw new Error("Authentication is not configured.");
  instance ??= createAuth();
  return instance;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: Role;
  status: Status;
}

/** The signed-in user (fresh from the database), or null. Deduplicated per request. */
export const getCurrentUser = cache(async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!isAuthEnabled()) return null;
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return null;
  const u = session.user as typeof session.user & { role?: Role; status?: Status };
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image ?? null,
    role: (u.role as Role) ?? "member",
    status: (u.status as Status) ?? "pending",
  };
});
