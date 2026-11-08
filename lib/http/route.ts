import { randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { readSession, SESSION_COOKIE, StaffUser } from "@/lib/auth/sessions";
import { Db, getDb } from "@/lib/db";
import { createLogger, Logger } from "@/lib/observability/logger";
import { getIp, hashKey, Limiter } from "@/lib/rate-limit";

const DEFAULT_MAX_BYTES = 64 * 1024;

// Required with no default, so a route can't skip the decision:
// - public: deliberately open (health, login, starting a demo call)
// - call-token: open, but the handler must verify the signed call token in the body
// - staff: a valid session holding this permission
// - service: scheduled jobs presenting CRON_SECRET
export type RouteAccess = "public" | "call-token" | "service" | { staff: Permission };

type DynamicParams = { params: Promise<Record<string, string>> };

export interface RouteContext<Body, Staff> {
  req: NextRequest;
  body: Body;
  params: Record<string, string>;
  correlationId: string;
  log: Logger;
  fail(code: string, status: number): NextResponse;
  user: Staff;
  db: Staff extends StaffUser ? Db : Db | null;
}

interface RouteOptions<Schema extends z.ZodType | undefined, Access extends RouteAccess> {
  name: string;
  access: Access;
  limiter: Limiter;
  body?: Schema;
  maxBytes?: number;
  handler(ctx: RouteContext<
    Schema extends z.ZodType ? z.output<Schema> : undefined,
    Access extends { staff: Permission } ? StaffUser : undefined
  >): Promise<Response>;
}

function serviceAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const given  = req.headers.get("authorization");
  if (!secret || !given) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual   = Buffer.from(given);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// SameSite=Strict cookies do most of the work. This is the second layer for browsers that don't.
function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
  } catch {
    return false;
  }
}

// Every API route goes through this: correlation ID, rate limit, authorization, size limit,
// validation, and an error envelope that never contains upstream or database text.
export function route<Schema extends z.ZodType | undefined = undefined, Access extends RouteAccess = RouteAccess>(
  options: RouteOptions<Schema, Access>,
) {
  return async (req: NextRequest, segment?: DynamicParams): Promise<Response> => {
    const correlationId = randomUUID();
    const log           = createLogger(correlationId);
    const startedAt     = Date.now();

    const fail = (code: string, status: number) =>
      NextResponse.json({ error: { code, correlationId } }, { status });

    const run = async (): Promise<Response> => {
      const { success } = await options.limiter.limit(hashKey(getIp(req)));
      if (!success) return fail("rate_limited", 429);

      const db = await getDb();
      let user: StaffUser | undefined;
      const access: RouteAccess = options.access;

      if (access === "service" && !serviceAuthorized(req)) return fail("unauthorized", 401);

      if (typeof access === "object") {
        if (!db) return fail("no-db", 503);
        user = (await readSession(db, req.cookies.get(SESSION_COOKIE)?.value)) ?? undefined;
        if (!user) {
          await writeAudit(db, { action: "access.denied", targetType: "route", targetId: options.name, correlationId, metadata: { reason: "no_session" } });
          return fail("unauthorized", 401);
        }
        if (!hasPermission(user.roles, access.staff)) {
          await writeAudit(db, {
            action: "access.denied", actorId: user.id, organizationId: user.organizationId,
            targetType: "route", targetId: options.name, correlationId, metadata: { reason: "missing_permission" },
          });
          return fail("forbidden", 403);
        }
        if (req.method !== "GET" && !sameOrigin(req)) return fail("bad_origin", 403);
      }

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

      type Ctx = Parameters<typeof options.handler>[0];
      return options.handler({
        req, correlationId, log, fail, db, user, body,
        params: segment ? await segment.params : {},
      } as Ctx);
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
