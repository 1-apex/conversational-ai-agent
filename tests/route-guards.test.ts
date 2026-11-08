import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";

const apiDir = path.resolve(__dirname, "../app/api");
const routeFiles = (fs.readdirSync(apiDir, { recursive: true }) as string[])
  .filter((file) => path.basename(file) === "route.ts")
  .map((file) => file.replaceAll("\\", "/"));

// Anything public or token-based must be listed here on purpose. A new route handling call
// data or staff work that forgets `{ staff: ... }` fails this test.
const DELIBERATELY_NOT_STAFF: Record<string, string> = {
  "calls/route.ts": "public",
  "calls/[id]/turns/route.ts": "call-token",
  "calls/[id]/end/route.ts": "call-token",
  "calls/[id]/callback/route.ts": "call-token",
  "tts/route.ts": "call-token",
  "auth/login/route.ts": "public",
  "auth/logout/route.ts": "public",
  "auth/me/route.ts": "public",
  "health/route.ts": "public",
  "internal/retention/route.ts": "service",
};

describe("every API route", () => {
  it("was found", () => {
    expect(routeFiles.length).toBeGreaterThanOrEqual(19);
  });

  it.each(routeFiles)("%s uses the wrapper with the expected access", (file) => {
    const source = fs.readFileSync(path.join(apiDir, file), "utf8");
    expect(source).toMatch(/export const (GET|POST|PUT|PATCH|DELETE) = route\(/);
    expect(source).not.toMatch(/export (async )?function (GET|POST|PUT|PATCH|DELETE)/);
    expect(source).not.toContain("req.json()");

    const expected = DELIBERATELY_NOT_STAFF[file];
    if (expected) {
      expect(source).toContain(`access: "${expected}"`);
    } else {
      const handlers = source.match(/= route\(/g)!.length;
      expect(source.match(/access: \{ staff: "/g)?.length, `${file} must require staff access`).toBe(handlers);
    }
  });

  it("the token routes verify their token", () => {
    for (const file of Object.keys(DELIBERATELY_NOT_STAFF).filter((f) => DELIBERATELY_NOT_STAFF[f] === "call-token")) {
      expect(fs.readFileSync(path.join(apiDir, file), "utf8")).toMatch(/verify(CallState|Speech)\(/);
    }
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
