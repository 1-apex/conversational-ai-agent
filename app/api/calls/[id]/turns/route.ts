import { NextResponse } from "next/server";
import { signCallState, signSpeech, verifyCallState } from "@/lib/conversation/call-token";
import { productionDeps } from "@/lib/conversation/deps";
import { processTurn } from "@/lib/conversation/pipeline";
import { loadCallGuard, persistTurn } from "@/lib/conversation/store";
import { route } from "@/lib/http/route";
import { TurnRequestSchema } from "@/lib/http/schemas";
import { agentLimiter } from "@/lib/rate-limit";

export const POST = route({
  name: "calls.turn",
  access: "call-token",
  limiter: agentLimiter,
  body: TurnRequestSchema,
  maxBytes: 512 * 1024,
  handler: async ({ body, params, db, fail, log }) => {
    const call = verifyCallState(body.callToken);
    if (!call || call.callId !== params.id) return fail("invalid_call_token", 401);

    // The stored row wins, so replaying an old token can't escape a lock or reopen a call
    const guard = await loadCallGuard(db, call.callId);
    if (guard?.endedAt) return fail("call_ended", 409);
    if (guard?.emergencyLocked) call.emergencyLocked = true;

    const text = body.text?.trim() ?? "";
    if (body.event === "message" && !text) return fail("invalid_request", 400);
    if (body.event === "takeover" && !call.pendingTakeover) return fail("no_pending_takeover", 409);
    if (body.event === "silence" && call.checkins >= 1) return fail("no_more_checkins", 409);

    const result = await processTurn(call, { event: body.event, text }, productionDeps(db));
    const { escalationId } = await persistTurn(db, log, { result });

    log.info("turn.completed", {
      route: "calls.turn", code: result.pathway,
      durationMs: result.timings.totalMs,
    });

    return NextResponse.json({
      callToken: signCallState(result.call),
      turnId: result.turnId,
      text: result.text,
      agent: result.agent,
      nextAgent: result.call.agent,
      pathway: result.pathway,
      handoff: result.handoff,
      escalationId,
      speechToken: signSpeech(call.callId, result.text),
    });
  },
});
