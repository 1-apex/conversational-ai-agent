import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { readSession, revokeSession, SESSION_COOKIE } from "@/lib/auth/sessions";
import { route } from "@/lib/http/route";
import { loginLimiter } from "@/lib/rate-limit";

export const POST = route({
  name: "auth.logout",
  access: "public", // works with an expired session, and only ever ends the sender's own
  limiter: loginLimiter,
  handler: async ({ req, db, correlationId }) => {
    if (db) {
      const user = await readSession(db, req.cookies.get(SESSION_COOKIE)?.value);
      if (user) {
        await revokeSession(db, user.sessionId);
        await writeAudit(db, { action: "auth.logout", actorId: user.id, organizationId: user.organizationId, correlationId });
      }
    }
    const response = NextResponse.json({ ok: true });
    response.cookies.delete(SESSION_COOKIE);
    return response;
  },
});
