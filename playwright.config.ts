import { defineConfig } from "@playwright/test";

// Uses a throwaway in-memory database and no provider keys, so no real service is reached.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: { baseURL: "http://localhost:3100", permissions: [] },
  webServer: {
    command: "npx tsx scripts/e2e-server.mts",
    url: "http://localhost:3100/api/health",
    timeout: 180_000,
    reuseExistingServer: false,
    stdout: "pipe",
  },
});
