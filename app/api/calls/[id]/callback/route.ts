import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { verifyCallState } from "@/lib/conversation/call-token";
import { createEscalation, encryptContact, getDefaultOrganizationId } from "@/lib/conversation/store";
import { escalationEvents, escalations } from "@/lib/db/schema";
import { route } from "@/lib/http/route";
import { CallbackRequestSchema } from "@/lib/http/schemas";
import { callStartLimiter } from "@/lib/rate-limit";

export const POST = route({
  name: "calls.callback",
  access: "call-token",
  limiter: callStartLimiter,
  body: CallbackRequestSchema,
  maxBytes: 512 * 1024,
  handler: async ({ body, params, db, fail }) => {
    const call = verifyCallState(body.callToken);
    if (!call || call.callId !== params.id) return fail("invalid_call_token", 401);
    if (!db) return fail("no-db", 503);

    const organizationId = await getDefaultOrganizationId(db);
    const [open] = await db.select({ id: escalations.id }).from(escalations).where(and(
      eq(escalations.callId, call.callId), inArray(escalations.status, ["open", "assigned"]),
    )).limit(1);
    const escalationId = open?.id ?? await createEscalation(db, organizationId, call.callId, "human_request");

    await db.update(escalations).set({
      encryptedContact: encryptContact(body.phone), preferredWindow: body.window ?? null,
      updatedAt: new Date(),
    }).where(eq(escalations.id, escalationId));
    await db.insert(escalationEvents).values({ escalationId, eventType: "callback_requested" });
    await writeAudit(db, { action: "escalation.callback_requested", organizationId, targetType: "escalation", targetId: escalationId });

    return NextResponse.json({ ok: true, escalationId });
  },
});
