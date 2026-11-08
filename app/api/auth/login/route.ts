import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { ABSOLUTE_LIFETIME_MS, createSession, DUMMY_PASSWORD_HASH, SESSION_COOKIE, verifyPassword } from "@/lib/auth/sessions";
import { users } from "@/lib/db/schema";
import { route } from "@/lib/http/route";
import { loginLimiter } from "@/lib/rate-limit";

const LoginSchema = z.object({
  email:    z.string().email().max(200),
  password: z.string().min(1).max(200),
});

export const POST = route({
  name: "auth.login",
  access: "public",
  limiter: loginLimiter,
  body: LoginSchema,
  handler: async ({ body, db, fail, correlationId }) => {
    if (!db) return fail("no-db", 503);

    const email  = body.email.toLowerCase();
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const valid  = await verifyPassword(body.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

    if (!user || !valid || user.status !== "active") {
      await writeAudit(db, {
        action: "auth.login_failed", actorId: user?.id ?? null, organizationId: user?.organizationId ?? null, correlationId,
      });
      return fail("invalid_credentials", 401); // the same whichever part was wrong
    }

    const { token } = await createSession(db, user.id);
    await writeAudit(db, { action: "auth.login", actorId: user.id, organizationId: user.organizationId, correlationId });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production",
      path: "/", maxAge: ABSOLUTE_LIFETIME_MS / 1000,
    });
    return response;
  },
});
