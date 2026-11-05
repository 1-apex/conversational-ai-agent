import { describe, expect, it, vi } from "vitest";
import { getIp, hashKey, InMemoryLimiter } from "@/lib/rate-limit";

const withHeaders = (headers: Record<string, string>) => new Request("http://localhost", { headers });

describe("InMemoryLimiter", () => {
  it("blocks past the limit and recovers after the window", async () => {
    vi.useFakeTimers();
    try {
      const limiter = new InMemoryLimiter(2, 1000);
      expect((await limiter.limit("a")).success).toBe(true);
      expect((await limiter.limit("a")).success).toBe(true);
      expect((await limiter.limit("a")).success).toBe(false);
      expect((await limiter.limit("b")).success).toBe(true);
      vi.advanceTimersByTime(1001);
      expect((await limiter.limit("a")).success).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("doesn't grow without bound", async () => {
    const limiter = new InMemoryLimiter(1, 60_000);
    for (let i = 0; i < 10_050; i++) await limiter.limit(`key-${i}`);
    expect(limiter.trackedKeys).toBeLessThanOrEqual(10_000);
  });
});

describe("getIp", () => {
  it("ignores a client-forged first x-forwarded-for entry", () => {
    expect(getIp(withHeaders({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("prefers platform headers", () => {
    expect(getIp(withHeaders({
      "x-vercel-forwarded-for": "198.51.100.1",
      "x-real-ip": "198.51.100.2",
      "x-forwarded-for": "6.6.6.6",
    }))).toBe("198.51.100.1");
    expect(getIp(withHeaders({ "x-real-ip": "198.51.100.2", "x-forwarded-for": "6.6.6.6" }))).toBe("198.51.100.2");
  });

  it("has a default when no header is present", () => {
    expect(getIp(withHeaders({}))).toBe("127.0.0.1");
  });
});

describe("hashKey", () => {
  it("doesn't contain the raw IP and is stable", () => {
    expect(hashKey("203.0.113.9")).not.toContain("203.0.113.9");
    expect(hashKey("203.0.113.9")).toBe(hashKey("203.0.113.9"));
    expect(hashKey("203.0.113.9")).not.toBe(hashKey("203.0.113.10"));
  });
});
