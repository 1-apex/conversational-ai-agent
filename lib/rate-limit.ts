import { createHash } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type Limiter = { limit(key: string): Promise<{ success: boolean }> };

const MAX_TRACKED_KEYS = 10_000;

// Simple sliding-window rate limiter backed by in-process memory.
// Works without any external service. Each serverless instance has its own
// window, which is fine for single-process dev and acceptable for light prod
// traffic. Add Upstash env vars to share limits across instances.
export class InMemoryLimiter implements Limiter {
  private windows = new Map<string, number[]>();
  constructor(private max: number, private windowMs: number) {}

  async limit(key: string): Promise<{ success: boolean }> {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const hits = (this.windows.get(key) ?? []).filter((t) => t > cutoff);
    if (hits.length >= this.max) return { success: false };
    hits.push(now);
    this.windows.set(key, hits);
    if (this.windows.size > MAX_TRACKED_KEYS) this.evict(cutoff);
    return { success: true };
  }

  get trackedKeys() { return this.windows.size; }

  private evict(cutoff: number) {
    for (const [key, hits] of this.windows) {
      if (!hits.some((t) => t > cutoff)) this.windows.delete(key);
    }
    // Everything still active: drop the oldest entries, as Map keeps insertion order
    for (const key of this.windows.keys()) {
      if (this.windows.size <= MAX_TRACKED_KEYS) break;
      this.windows.delete(key);
    }
  }
}

function makeLimiter(requests: number, windowSeconds: number): Limiter {
  const local = new InMemoryLimiter(requests, windowSeconds * 1000);
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const shared = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(requests, `${windowSeconds} s`),
      prefix: "inogen:rl",
    });
    return {
      // A Redis outage shouldn't take calls down, or remove limits altogether
      limit: (key) => shared.limit(key).catch(() => local.limit(key)),
    };
  }
  return local;
}

export const agentLimiter     = makeLimiter(30, 60);
export const ttsLimiter       = makeLimiter(30, 60);
export const extractLimiter   = makeLimiter(5,  60);
export const callLogLimiter   = makeLimiter(10, 60);
export const analyticsLimiter = makeLimiter(30, 60);

// The first x-forwarded-for entry is whatever the client sent, so it can't be trusted.
// Prefer headers the platform sets; otherwise use the last entry, added by the nearest proxy.
export function getIp(req: Request): string {
  const platform = req.headers.get("x-vercel-forwarded-for") ?? req.headers.get("x-real-ip");
  if (platform) return platform.split(",")[0].trim();
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",").at(-1)!.trim() : "127.0.0.1";
}

// Keeps raw IP addresses out of Redis
export function hashKey(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}
