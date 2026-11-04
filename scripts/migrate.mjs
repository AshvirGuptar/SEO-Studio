/**
 * Applies pending database migrations from /drizzle. Runs before `next build` (so Vercel deploys
 * migrate automatically) and can be run by hand with `npm run db:migrate`.
 * Skips quietly when no database is configured.
 */
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.log("[migrate] No DATABASE_URL set; skipping migrations.");
  process.exit(0);
}

if (url.startsWith("pglite://")) {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite(url.slice("pglite://".length));
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  await client.close();
} else {
  const { neon } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-http");
  const { migrate } = await import("drizzle-orm/neon-http/migrator");
  await migrate(drizzle(neon(url)), { migrationsFolder: "./drizzle" });
}
console.log("[migrate] Database is up to date.");
