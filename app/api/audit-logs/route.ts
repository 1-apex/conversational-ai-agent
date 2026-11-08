import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { verifyAuditChain } from "@/lib/audit";
import { auditLogs } from "@/lib/db/schema";
import { route } from "@/lib/http/route";
import { staffLimiter } from "@/lib/rate-limit";

export const GET = route({
  name: "audit.list",
  access: { staff: "audit:read" },
  limiter: staffLimiter,
  handler: async ({ db, user }) => {
    const entries = await db.select().from(auditLogs)
      .where(eq(auditLogs.organizationId, user.organizationId)).orderBy(desc(auditLogs.id)).limit(200);
    const brokenAt = await verifyAuditChain(db);
    return NextResponse.json({ entries, chain: { intact: brokenAt === null, brokenAt } });
  },
});
