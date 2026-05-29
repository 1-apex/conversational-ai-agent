import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type Limiter = Pick<Ratelimit, "limit">;

function makeLimiter(requests: number, windowSeconds: number): Limiter {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(requests, `${windowSeconds} s`),
      prefix: "kyron:rl",
    });
  }
  // Ephemeral in-memory fallback — works in dev without any external service.
  // Each serverless instance has its own store; good enough for abuse prevention
  // in single-process dev. Add Upstash env vars for production.
  return new Ratelimit({
    redis: new Map() as unknown as Redis,
    limiter: Ratelimit.slidingWindow(requests, `${windowSeconds} s`),
    prefix: "kyron:rl",
  });
}

// Per-route limiters — tuned to a realistic phone call session.
// agent: ~15 turns/call, allow 2 concurrent sessions per IP
// tts:   same cadence as agent
// extract: called once per call, 5/min covers rapid retries
export const agentLimiter   = makeLimiter(30, 60);
export const ttsLimiter     = makeLimiter(30, 60);
export const extractLimiter = makeLimiter(5,  60);

export function getIp(req: Request): string {
  const forwarded = (req.headers as Headers).get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";
}
