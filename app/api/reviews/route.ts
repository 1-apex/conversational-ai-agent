import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { calls, callSummaries, reviewItems, users } from "@/lib/db/schema";
import { route } from "@/lib/http/route";
import { staffLimiter } from "@/lib/rate-limit";

const FAILURE_CLASSES = ["hallucination", "unsafe_response", "wrong_routing", "bad_summary", "unresolved", "other"] as const;

const ReviewSchema = z.object({
  callId:       z.string().uuid(),
  failureClass: z.enum(FAILURE_CLASSES),
  notes:        z.string().max(2000).optional(),
  correctedSummary: z.string().max(4000).optional(),
  // Goes into a queue for a person to add to the dataset. It never changes anything by itself.
  proposedCase: z.object({
    input:            z.string().max(2000),
    expectedBehavior: z.string().max(500),
    category:         z.string().max(60),
  }).optional(),
});

export const GET = route({
  name: "reviews.list",
  access: { staff: "reviews:write" },
  limiter: staffLimiter,
  handler: async ({ db, user }) => {
    const rows = await db.select({
      id: reviewItems.id, callId: reviewItems.callId, failureClass: reviewItems.failureClass,
      notes: reviewItems.notes, status: reviewItems.status, proposedCase: reviewItems.proposedCase,
      createdAt: reviewItems.createdAt, reviewerName: users.displayName,
    }).from(reviewItems).innerJoin(users, eq(users.id, reviewItems.reviewerId))
      .where(eq(reviewItems.organizationId, user.organizationId)).orderBy(desc(reviewItems.createdAt)).limit(200);
    return NextResponse.json({ reviews: rows });
  },
});

export const POST = route({
  name: "reviews.create",
  access: { staff: "reviews:write" },
  limiter: staffLimiter,
  body: ReviewSchema,
  handler: async ({ body, db, user, fail, correlationId }) => {
    const [call] = await db.select({ id: calls.id }).from(calls)
      .where(and(eq(calls.id, body.callId), eq(calls.organizationId, user.organizationId))).limit(1);
    if (!call) return fail("not_found", 404);

    const [review] = await db.insert(reviewItems).values({
      organizationId: user.organizationId, callId: call.id, reviewerId: user.id,
      failureClass: body.failureClass, notes: body.notes ?? null, proposedCase: body.proposedCase ?? null,
    }).returning({ id: reviewItems.id });

    if (body.correctedSummary) {
      const [existing] = await db.select().from(callSummaries).where(eq(callSummaries.callId, call.id)).limit(1);
      if (existing) {
        // The original is kept alongside the correction, so errors can be measured later
        await db.update(callSummaries).set({
          humanCorrected: true,
          intelligence: {
            ...(existing.intelligence as object),
            summary: body.correctedSummary,
            originalSummary: (existing.intelligence as { summary?: string }).summary,
            summaryProvenance: "human_corrected",
          },
        }).where(eq(callSummaries.callId, call.id));
      }
    }

    await writeAudit(db, {
      action: "review.created", actorId: user.id, organizationId: user.organizationId,
      targetType: "call", targetId: call.id, correlationId,
      metadata: { failureClass: body.failureClass, corrected: Boolean(body.correctedSummary), proposedCase: Boolean(body.proposedCase) },
    });
    return NextResponse.json({ id: review.id }, { status: 201 });
  },
});
