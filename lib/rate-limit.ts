import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type Limiter = { limit(key: string): Promise<{ success: boolean }> };

// Simple sliding-window rate limiter backed by in-process memory.
// Works without any external service. Each serverless instance has its own
// window, which is fine for single-process dev and acceptable for light prod
// traffic. Add Upstash env vars to share limits across instances.
class InMemoryLimiter implements Limiter {
  private windows = new Map<string, number[]>();
  constructor(private max: number, private windowMs: number) {}

  async limit(key: string): Promise<{ success: boolean }> {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const hits = (this.windows.get(key) ?? []).filter((t) => t > cutoff);
    if (hits.length >= this.max) return { success: false };
    hits.push(now);
    this.windows.set(key, hits);
    return { success: true };
  }
}

function makeLimiter(requests: number, windowSeconds: number): Limiter {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(requests, `${windowSeconds} s`),
      prefix: "kyron:rl",
    });
  }
  return new InMemoryLimiter(requests, windowSeconds * 1000);
}

export const agentLimiter   = makeLimiter(30, 60);
export const ttsLimiter     = makeLimiter(30, 60);
export const extractLimiter = makeLimiter(5,  60);

export function getIp(req: Request): string {
  const forwarded = (req.headers as Headers).get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";
}
