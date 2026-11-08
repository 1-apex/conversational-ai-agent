import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { revokeAllSessions } from "@/lib/auth/sessions";
import { users } from "@/lib/db/schema";
import { route } from "@/lib/http/route";
import { staffLimiter } from "@/lib/rate-limit";

export const POST = route({
  name: "staff.users.revoke",
  access: { staff: "sessions:manage" },
  limiter: staffLimiter,
  handler: async ({ params, db, user, fail, correlationId }) => {
    const [target] = await db.select({ id: users.id }).from(users)
      .where(and(eq(users.id, params.id), eq(users.organizationId, user.organizationId))).limit(1);
    if (!target) return fail("not_found", 404);

    await revokeAllSessions(db, target.id);
    await writeAudit(db, {
      action: "auth.sessions_revoked", actorId: user.id, organizationId: user.organizationId,
      targetType: "user", targetId: target.id, correlationId,
    });
    return NextResponse.json({ ok: true });
  },
});
