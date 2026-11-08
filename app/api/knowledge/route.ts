import { desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { knowledgeChunks, knowledgeDocuments, knowledgeVersions, users } from "@/lib/db/schema";
import { route } from "@/lib/http/route";
import { getEmbedder } from "@/lib/knowledge/embeddings";
import { ingestDocument } from "@/lib/knowledge/ingest";
import { staffLimiter } from "@/lib/rate-limit";

const MAX_DOCUMENT_BYTES = 1024 * 1024;

const UploadSchema = z.object({
  title:         z.string().min(1).max(200),
  sourceType:    z.enum(["official", "public_page_unverified", "legacy_unverified", "synthetic_test"]),
  sourceUrl:     z.url().max(500).optional(),
  product:       z.string().max(100).optional(),
  audience:      z.enum(["consumer", "business"]).default("consumer"),
  content:       z.string().min(1).max(MAX_DOCUMENT_BYTES),
  effectiveDate: z.iso.date().optional(),
  expiryDate:    z.iso.date().optional(),
});

export const GET = route({
  name: "knowledge.list",
  access: { staff: "knowledge:read" },
  limiter: staffLimiter,
  handler: async ({ db, user }) => {
    const versions = await db.select({
      versionId: knowledgeVersions.id, version: knowledgeVersions.version, status: knowledgeVersions.status,
      flags: knowledgeVersions.flags, effectiveDate: knowledgeVersions.effectiveDate, expiryDate: knowledgeVersions.expiryDate,
      createdAt: knowledgeVersions.createdAt, uploadedBy: knowledgeVersions.uploadedBy, uploaderName: users.displayName,
      documentId: knowledgeDocuments.id, title: knowledgeDocuments.title, sourceType: knowledgeDocuments.sourceType,
      sourceUrl: knowledgeDocuments.sourceUrl, product: knowledgeDocuments.product, audience: knowledgeDocuments.audience,
      chunkCount: sql<number>`(SELECT count(*)::int FROM ${knowledgeChunks} WHERE ${knowledgeChunks.versionId} = ${knowledgeVersions.id})`,
    }).from(knowledgeVersions)
      .innerJoin(knowledgeDocuments, eq(knowledgeDocuments.id, knowledgeVersions.documentId))
      .innerJoin(users, eq(users.id, knowledgeVersions.uploadedBy))
      .where(eq(knowledgeDocuments.organizationId, user.organizationId))
      .orderBy(desc(knowledgeVersions.createdAt)).limit(200);
    return NextResponse.json({ versions, viewerId: user.id });
  },
});

export const POST = route({
  name: "knowledge.upload",
  access: { staff: "knowledge:upload" },
  limiter: staffLimiter,
  body: UploadSchema,
  maxBytes: MAX_DOCUMENT_BYTES + 4096,
  handler: async ({ body, db, user, correlationId }) => {
    const result = await ingestDocument(db, {
      ...body, organizationId: user.organizationId, uploadedBy: user.id,
    }, getEmbedder());
    await writeAudit(db, {
      action: "knowledge.uploaded", actorId: user.id, organizationId: user.organizationId,
      targetType: "knowledge_version", targetId: result.version.id, correlationId,
      metadata: { chunks: result.chunkCount, flags: result.version.flags.join(",") },
    });
    return NextResponse.json({
      versionId: result.version.id, version: result.version.version, status: result.version.status,
      flags: result.version.flags, chunkCount: result.chunkCount,
    }, { status: 201 });
  },
});
