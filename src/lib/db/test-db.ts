/** In-memory Postgres for tests (PGlite) with all migrations applied. */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";
import { setDbForTests, type Db } from "./index";

export async function createTestDb(): Promise<Db> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  setDbForTests(db as unknown as Db);
  return db as unknown as Db;
}
