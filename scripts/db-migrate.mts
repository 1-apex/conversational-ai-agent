import nextEnv from "@next/env";
import { runMigrations } from "@/lib/db";

nextEnv.loadEnvConfig(process.cwd());

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

await runMigrations(url);
console.log("Migrations applied");
