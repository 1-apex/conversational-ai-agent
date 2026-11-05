import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createLogger, Logger } from "@/lib/observability/logger";
import { getIp, hashKey, Limiter } from "@/lib/rate-limit";

const DEFAULT_MAX_BYTES = 64 * 1024;

export interface RouteContext<Body> {
  req: NextRequest;
  body: Body;
  correlationId: string;
  log: Logger;
  fail(code: string, status: number): NextResponse;
}

interface RouteOptions<Schema extends z.ZodType | undefined> {
  name: string;
  // Required with no default, so a route can't skip the decision. "public" means
  // deliberately unauthenticated; call-data routes move to staff access with auth.
  access: "public";
  limiter: Limiter;
  body?: Schema;
  maxBytes?: number;
  handler(ctx: RouteContext<Schema extends z.ZodType ? z.output<Schema> : undefined>): Promise<Response>;
}

// Every API route goes through this: correlation ID, rate limit, size limit,
// validation, and an error envelope that never contains upstream or database text.
export function route<Schema extends z.ZodType | undefined = undefined>(options: RouteOptions<Schema>) {
  return async (req: NextRequest): Promise<Response> => {
    const correlationId = randomUUID();
    const log           = createLogger(correlationId);
    const startedAt     = Date.now();

    const fail = (code: string, status: number) =>
      NextResponse.json({ error: { code, correlationId } }, { status });

    const run = async (): Promise<Response> => {
      const { success } = await options.limiter.limit(hashKey(getIp(req)));
      if (!success) return fail("rate_limited", 429);

      let body: unknown = undefined;
      if (options.body) {
        const maxBytes      = options.maxBytes ?? DEFAULT_MAX_BYTES;
        const declaredBytes = Number(req.headers.get("content-length") ?? 0);
        if (declaredBytes > maxBytes) return fail("payload_too_large", 413);

        const text = await req.text();
        if (Buffer.byteLength(text) > maxBytes) return fail("payload_too_large", 413);

        let json: unknown;
        try {
          json = JSON.parse(text);
        } catch {
          return fail("invalid_json", 400);
        }

        const parsed = options.body.safeParse(json);
        if (!parsed.success) {
          log.warn("request.invalid", {
            route: options.name,
            issuePaths: parsed.error.issues.map((issue) => issue.path.join(".")),
          });
          return fail("invalid_request", 400);
        }
        body = parsed.data;
      }

      return options.handler({
        req, correlationId, log, fail,
        body: body as Schema extends z.ZodType ? z.output<Schema> : undefined,
      });
    };

    let response: Response;
    try {
      response = await run();
    } catch (error) {
      log.error("request.failed", {
        route: options.name,
        errorName: error instanceof Error ? error.name : "Unknown",
      });
      response = fail("internal_error", 500);
    }

    response.headers.set("X-Correlation-Id", correlationId);
    log.info("request.completed", {
      route: options.name, status: response.status, durationMs: Date.now() - startedAt,
    });
    return response;
  };
}
