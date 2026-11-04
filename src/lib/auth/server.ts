/**
 * Better Auth setup: Google sign-in, users stored in Postgres, invite-only access (see access.ts).
 *
 * Sign-in is ENABLED only when all of these are set; otherwise the app runs open (tools work,
 * Projects/Admin are unavailable). Required env vars:
 *   DATABASE_URL, BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 * Optional: BETTER_AUTH_URL (defaults to the Vercel production URL), ADMIN_EMAILS, AUTO_APPROVE_DOMAINS
 */
import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { cache } from "react";
import { getDb, schema } from "@/lib/db";
import { authEnvConfigured } from "./enabled";
import { accessConfigFromEnv, decideAccess, type Role, type Status } from "./access";
import { applyAccessOnSignIn, getInvite } from "@/lib/db/repo";

export function isAuthEnabled(): boolean {
  return authEnvConfigured();
}

function baseURL(): string | undefined {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return undefined;
}

function createAuth() {
  return betterAuth({
    baseURL: baseURL(),
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID ?? "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        prompt: "select_account",
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
            const access = decideAccess(u.email, accessConfigFromEnv(), { invite: inv });
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
