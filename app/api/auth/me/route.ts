import { NextResponse } from "next/server";
import { ROLE_PERMISSIONS, Role } from "@/lib/auth/permissions";
import { readSession, SESSION_COOKIE } from "@/lib/auth/sessions";
import { route } from "@/lib/http/route";
import { staffLimiter } from "@/lib/rate-limit";

export const GET = route({
  name: "auth.me",
  access: "public", // returns only the sender's own session; pages use it to decide what to show
  limiter: staffLimiter,
  handler: async ({ req, db, fail }) => {
    if (!db) return fail("no-db", 503);
    const user = await readSession(db, req.cookies.get(SESSION_COOKIE)?.value);
    if (!user) return fail("unauthorized", 401);
    return NextResponse.json({
      email: user.email, displayName: user.displayName, roles: user.roles,
      permissions: [...new Set(user.roles.flatMap((r) => ROLE_PERMISSIONS[r as Role] ?? []))],
    });
  },
});
