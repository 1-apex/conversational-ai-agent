import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { migrate as migrateNeon } from "drizzle-orm/neon-http/migrator";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./db/schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const MIGRATIONS_FOLDER = path.join(process.cwd(), "db", "migrations");

// Survives Next.js dev reloads, which matters because a PGlite directory allows one owner.
const cache = globalThis as unknown as { __db?: Promise<Db>; __dbUrl?: string };

// PGlite is real Postgres in-process. It is for local use and tests, never production.
async function connectPglite(url: string): Promise<Db> {
  if (process.env.VERCEL) throw new Error("pglite is not available on hosted deployments");
  const [{ PGlite }, { vector }, { drizzle }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("@electric-sql/pglite-pgvector"),
    import("drizzle-orm/pglite"),
  ]);
  const dataDir = url.slice("pglite://".length) || undefined; // pglite:// = in memory
  const client = await PGlite.create({ dataDir, extensions: { vector } });
  return drizzle(client, { schema, casing: "snake_case" }) as unknown as Db;
}

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export async function getDb(): Promise<Db | null> {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!cache.__db || cache.__dbUrl !== url) {
    cache.__dbUrl = url;
    cache.__db = url.startsWith("pglite://")
      ? connectPglite(url)
      : Promise.resolve(drizzleNeon(neon(url), { schema, casing: "snake_case" }) as unknown as Db);
  }
  return cache.__db;
}

// Migrations run from CI or the db:migrate script, never during a request.
export async function runMigrations(url: string): Promise<void> {
  if (url.startsWith("pglite://")) {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const db = await connectPglite(url);
    await migrate(db as never, { migrationsFolder: MIGRATIONS_FOLDER });
    await (db as unknown as { $client: { close(): Promise<void> } }).$client.close();
    return;
  }
  const db = drizzleNeon(neon(url), { schema, casing: "snake_case" });
  await migrateNeon(db, { migrationsFolder: MIGRATIONS_FOLDER });
}

// For tests: a fresh, migrated, in-memory database.
export async function createTestDb(): Promise<Db> {
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const db = await connectPglite("pglite://");
  await migrate(db as never, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
}

export function setDbForTests(db: Db | null): void {
  cache.__dbUrl = process.env.DATABASE_URL ?? "";
  cache.__db = db ? Promise.resolve(db) : undefined;
}
