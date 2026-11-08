import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { hasPermission } from "@/lib/auth/permissions";
import { calls, callSummaries, callTurns, escalations, safetyEvents } from "@/lib/db/schema";
import { route } from "@/lib/http/route";
import { staffLimiter } from "@/lib/rate-limit";

export const GET = route({
  name: "staff.calls.read",
  access: { staff: "escalations:read" }, // the narrowest role that can see any transcript; refined below
  limiter: staffLimiter,
  handler: async ({ params, db, user, fail, correlationId }) => {
    const [call] = await db.select().from(calls)
      .where(and(eq(calls.id, params.id), eq(calls.organizationId, user.organizationId))).limit(1);
    if (!call) return fail("not_found", 404); // also for other organizations: existence isn't revealed

    if (!hasPermission(user.roles, "transcript:read")) {
      // Support agents see a transcript only for an escalation assigned to them
      const [assigned] = await db.select({ id: escalations.id }).from(escalations)
        .where(and(eq(escalations.callId, call.id), eq(escalations.assignedTo, user.id))).limit(1);
      if (!assigned || !hasPermission(user.roles, "transcript:read_assigned")) return fail("forbidden", 403);
    }

    const turns = await db.select().from(callTurns).where(eq(callTurns.callId, call.id)).orderBy(asc(callTurns.sequence));
    const [summary] = await db.select().from(callSummaries).where(eq(callSummaries.callId, call.id)).limit(1);
    const events = await db.select().from(safetyEvents).where(eq(safetyEvents.callId, call.id));

    await writeAudit(db, {
      action: "transcript.read", actorId: user.id, organizationId: user.organizationId,
      targetType: "call", targetId: call.id, correlationId,
    });
    return NextResponse.json({ call, turns, summary: summary ?? null, safetyEvents: events });
  },
});

export const DELETE = route({
  name: "staff.calls.delete",
  access: { staff: "calls:delete" },
  limiter: staffLimiter,
  handler: async ({ params, db, user, fail, correlationId }) => {
    const deleted = await db.delete(calls)
      .where(and(eq(calls.id, params.id), eq(calls.organizationId, user.organizationId)))
      .returning({ id: calls.id });
    if (deleted.length === 0) return fail("not_found", 404);
    await writeAudit(db, {
      action: "call.deleted", actorId: user.id, organizationId: user.organizationId,
      targetType: "call", targetId: params.id, correlationId,
    });
    return NextResponse.json({ ok: true });
  },
});
