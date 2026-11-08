// Prepares a fresh local database, then starts the production build for Playwright.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const dataDir = path.join(process.cwd(), ".data", "e2e");
fs.rmSync(dataDir, { recursive: true, force: true });
fs.mkdirSync(dataDir, { recursive: true });

const env: NodeJS.ProcessEnv = {
  ...process.env,
  DATABASE_URL: `pglite://${dataDir}`,
  SEED_PASSWORD: "synthetic-e2e-password",
  CALL_TOKEN_SECRET: "synthetic-e2e-secret",
  GROQ_API_KEY: "",
  ELEVENLABS_API_KEY: "",
  ANTHROPIC_API_KEY: "",
  KNOWLEDGE_MODE: "retrieval",
};

const run = (args: string[]) => {
  const result = spawnSync("npx", args, { env, stdio: "inherit", shell: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

run(["tsx", "scripts/db-migrate.mts"]);
run(["tsx", "scripts/db-seed.mts"]);

const server = spawn("npx", ["next", "start", "-p", "3100"], { env, stdio: "inherit", shell: true });
server.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => server.kill());
