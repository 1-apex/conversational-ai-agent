import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { hasPermission } from "@/lib/auth/permissions";
import { decryptContact } from "@/lib/conversation/store";
import { escalationEvents, escalations, users } from "@/lib/db/schema";
import { route } from "@/lib/http/route";
import { staffLimiter } from "@/lib/rate-limit";

const STATUSES = ["open", "assigned", "in_progress", "callback_scheduled", "resolved", "unable_to_reach", "closed"] as const;

const PatchSchema = z.object({
  action:     z.enum(["claim", "assign", "status"]),
  assigneeId: z.string().uuid().optional(),
  status:     z.enum(STATUSES).optional(),
  outcome:    z.string().max(500).optional(),
});

export const GET = route({
  name: "escalations.read",
  access: { staff: "escalations:read" },
  limiter: staffLimiter,
  handler: async ({ params, db, user, fail, correlationId }) => {
    const [row] = await db.select().from(escalations)
      .where(and(eq(escalations.id, params.id), eq(escalations.organizationId, user.organizationId))).limit(1);
    if (!row) return fail("not_found", 404);

    const allowed = hasPermission(user.roles, "escalations:read_all") || row.assignedTo === user.id || !row.assignedTo;
    if (!allowed) return fail("forbidden", 403);

    // The number is revealed only to whoever is responsible for the callback
    const canSeeContact = row.assignedTo === user.id || hasPermission(user.roles, "escalations:assign");
    const contact = row.encryptedContact && canSeeContact ? decryptContact(row.encryptedContact) : null;
    if (contact) {
      await writeAudit(db, {
        action: "escalation.contact_read", actorId: user.id, organizationId: user.organizationId,
        targetType: "escalation", targetId: row.id, correlationId,
      });
    }
    const events = await db.select().from(escalationEvents)
      .where(eq(escalationEvents.escalationId, row.id)).orderBy(asc(escalationEvents.createdAt));

    const { encryptedContact: _hidden, ...safe } = row;
    return NextResponse.json({ escalation: { ...safe, contact, hasContact: Boolean(_hidden) }, events });
  },
});

export const PATCH = route({
  name: "escalations.update",
  access: { staff: "escalations:write" },
  limiter: staffLimiter,
  body: PatchSchema,
  handler: async ({ params, body, db, user, fail, correlationId }) => {
    const [row] = await db.select().from(escalations)
      .where(and(eq(escalations.id, params.id), eq(escalations.organizationId, user.organizationId))).limit(1);
    if (!row) return fail("not_found", 404);

    const isSupervisor = hasPermission(user.roles, "escalations:assign");
    const update: Partial<typeof escalations.$inferInsert> = { updatedAt: new Date() };
    let eventType: string;
    let detail: string | undefined;

    if (body.action === "claim") {
      if (row.assignedTo && row.assignedTo !== user.id) return fail("already_assigned", 409);
      update.assignedTo = user.id;
      update.status = "assigned";
      eventType = "claimed";
    } else if (body.action === "assign") {
      if (!isSupervisor) return fail("forbidden", 403);
      if (!body.assigneeId) return fail("invalid_request", 400);
      const [assignee] = await db.select({ id: users.id }).from(users)
        .where(and(eq(users.id, body.assigneeId), eq(users.organizationId, user.organizationId))).limit(1);
      if (!assignee) return fail("not_found", 404);
      update.assignedTo = assignee.id;
      update.status = "assigned";
      eventType = "assigned";
    } else {
      if (!isSupervisor && row.assignedTo !== user.id) return fail("forbidden", 403);
      if (!body.status) return fail("invalid_request", 400);
      update.status = body.status;
      if (body.outcome) update.outcome = body.outcome;
      eventType = `status:${body.status}`;
      detail = body.outcome;
    }

    await db.update(escalations).set(update).where(eq(escalations.id, row.id));
    await db.insert(escalationEvents).values({ escalationId: row.id, actorId: user.id, eventType, detail });
    await writeAudit(db, {
      action: `escalation.${eventType}`, actorId: user.id, organizationId: user.organizationId,
      targetType: "escalation", targetId: row.id, correlationId,
    });
    return NextResponse.json({ ok: true });
  },
});
