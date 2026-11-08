import { and, asc, desc, eq, isNull, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { hasPermission } from "@/lib/auth/permissions";
import { escalations, users } from "@/lib/db/schema";
import { route } from "@/lib/http/route";
import { staffLimiter } from "@/lib/rate-limit";

export const GET = route({
  name: "escalations.list",
  access: { staff: "escalations:read" },
  limiter: staffLimiter,
  handler: async ({ db, user }) => {
    const seeAll = hasPermission(user.roles, "escalations:read_all");
    const rows = await db.select({
      id: escalations.id, callId: escalations.callId, reason: escalations.reason,
      priority: escalations.priority, status: escalations.status, assignedTo: escalations.assignedTo,
      assigneeName: users.displayName, preferredWindow: escalations.preferredWindow,
      createdAt: escalations.createdAt, updatedAt: escalations.updatedAt, outcome: escalations.outcome,
    }).from(escalations).leftJoin(users, eq(users.id, escalations.assignedTo))
      .where(and(
        eq(escalations.organizationId, user.organizationId),
        // Support agents see their own work and anything unclaimed
        seeAll ? undefined : or(eq(escalations.assignedTo, user.id), isNull(escalations.assignedTo)),
      ))
      .orderBy(asc(escalations.priority), desc(escalations.createdAt)).limit(200);

    return NextResponse.json({ escalations: rows });
  },
});
