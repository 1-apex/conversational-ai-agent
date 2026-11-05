import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";

const apiDir = path.resolve(__dirname, "../app/api");
const routeFiles = (fs.readdirSync(apiDir, { recursive: true }) as string[])
  .filter((file) => path.basename(file) === "route.ts");

describe("every API route", () => {
  it("was found", () => {
    expect(routeFiles.length).toBeGreaterThanOrEqual(5);
  });

  // A new route that skips the wrapper fails here, rather than shipping unprotected
  it.each(routeFiles)("%s uses the route wrapper and declares access", (file) => {
    const source = fs.readFileSync(path.join(apiDir, file), "utf8");
    expect(source).toMatch(/export const (GET|POST|PUT|PATCH|DELETE) = route\(/);
    expect(source).toMatch(/access: "/);
    expect(source).not.toMatch(/export (async )?function (GET|POST|PUT|PATCH|DELETE)/);
    expect(source).not.toContain("req.json()");
  });
});

describe("security headers", () => {
  it("sets the expected policy", async () => {
    const [{ headers }] = await nextConfig.headers!();
    const get = (key: string) => headers.find((h) => h.key === key)?.value;

    expect(get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(get("Content-Security-Policy")).toContain("object-src 'none'");
    expect(get("Content-Security-Policy")).toContain("media-src 'self' blob:");
    expect(get("Strict-Transport-Security")).toContain("max-age=");
    expect(get("Permissions-Policy")).toContain("microphone=(self)");
    expect(get("X-XSS-Protection")).toBeUndefined();
  });
});
