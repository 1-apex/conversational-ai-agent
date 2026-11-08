import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { assertSyntheticMode } from "@/lib/config";
import { newCallState, signCallState, signSpeech } from "@/lib/conversation/call-token";
import { startCall } from "@/lib/conversation/pipeline";
import { persistCallStart } from "@/lib/conversation/store";
import { route } from "@/lib/http/route";
import { callStartLimiter } from "@/lib/rate-limit";

export const POST = route({
  name: "calls.start",
  access: "public",
  limiter: callStartLimiter,
  handler: async ({ db, log }) => {
    assertSyntheticMode();
    const callId = randomUUID();
    const started = startCall(newCallState(callId));
    await persistCallStart(db, log, callId, { turnId: started.turnId, text: started.text });

    return NextResponse.json({
      callId,
      callToken: signCallState(started.call),
      turnId: started.turnId,
      text: started.text,
      agent: started.call.agent,
      speechToken: signSpeech(callId, started.text),
    }, { status: 201 });
  },
});
