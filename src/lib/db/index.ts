/**
 * Database access.
 *  - Production / Vercel: Neon over HTTP (DATABASE_URL=postgres://…), serverless-friendly.
 *  - Local development without Neon: DATABASE_URL=pglite://./.data/dev-db (embedded Postgres in a folder).
 *  - Tests inject an in-memory PGlite database with setDbForTests().
 */
import { createRequire } from "node:module";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/** Vercel's Neon integration sets DATABASE_URL (and POSTGRES_URL on older setups). */
export function databaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || undefined;
}

// Stored on globalThis: Next.js may load this module separately for pages and route handlers, and an
// embedded (PGlite) database must have exactly one instance per process to see its own writes.
const g = globalThis as typeof globalThis & { __seoStudioDb?: Db | null };

export function getDb(): Db {
  return (g.__seoStudioDb ??= createDb());
}

function createDb(): Db {
  const url = databaseUrl();
  if (!url) throw new Error("DATABASE_URL is not set.");
  if (url.startsWith("pglite://")) {
    // Dev-only embedded Postgres; loaded lazily so production bundles never need it.
    const require = createRequire(import.meta.url);
    const { PGlite } = require("@electric-sql/pglite");
    const { drizzle: drizzlePglite } = require("drizzle-orm/pglite");
    return drizzlePglite(new PGlite(url.slice("pglite://".length)), { schema }) as Db;
  }
  return drizzle(neon(url), { schema }) as unknown as Db;
}

export function setDbForTests(db: Db | null): void {
  g.__seoStudioDb = db;
}

export { schema };
