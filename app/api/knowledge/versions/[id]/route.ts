import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { knowledgeChunks } from "@/lib/db/schema";
import { route } from "@/lib/http/route";
import { ApprovalError, approveVersion, setVersionStatus } from "@/lib/knowledge/ingest";
import { staffLimiter } from "@/lib/rate-limit";

const ActionSchema = z.object({
  action: z.enum(["approve", "reject", "retire"]),
  reason: z.string().max(500).optional(),
});

export const GET = route({
  name: "knowledge.version.read",
  access: { staff: "knowledge:read" },
  limiter: staffLimiter,
  handler: async ({ params, db, fail }) => {
    if (!z.uuid().safeParse(params.id).success) return fail("not_found", 404);
    const chunks = await db.select({
      id: knowledgeChunks.id, section: knowledgeChunks.section,
      sourceLocation: knowledgeChunks.sourceLocation, content: knowledgeChunks.content,
    }).from(knowledgeChunks).where(eq(knowledgeChunks.versionId, params.id)).orderBy(asc(knowledgeChunks.sourceLocation));
    return NextResponse.json({ chunks });
  },
});

export const POST = route({
  name: "knowledge.version.action",
  access: { staff: "knowledge:approve" },
  limiter: staffLimiter,
  body: ActionSchema,
  handler: async ({ params, body, db, user, fail, correlationId }) => {
    try {
      if (body.action === "approve") await approveVersion(db, params.id, user.id, user.organizationId);
      else await setVersionStatus(db, params.id, user.organizationId, body.action === "reject" ? "rejected" : "retired", body.reason);
    } catch (error) {
      if (error instanceof ApprovalError) {
        if (error.code === "not_found") return fail("not_found", 404);
        return fail(error.code, 409);
      }
      throw error;
    }
    await writeAudit(db, {
      action: `knowledge.${body.action}`, actorId: user.id, organizationId: user.organizationId,
      targetType: "knowledge_version", targetId: params.id, correlationId,
    });
    return NextResponse.json({ ok: true });
  },
});
