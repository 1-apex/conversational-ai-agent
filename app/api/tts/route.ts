import { NextResponse } from "next/server";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { assertProviderAllowed } from "@/lib/config";
import { verifySpeech } from "@/lib/conversation/call-token";
import { route } from "@/lib/http/route";
import { SpeechRequestSchema } from "@/lib/http/schemas";
import { ttsLimiter } from "@/lib/rate-limit";

const VOICE_ID = "StsEnVb0Dmu25FGnhzqO";

// Speaks only text the server signed after validating it. There is no way to pass in other text.
export const POST = route({
  name: "tts",
  access: "call-token",
  limiter: ttsLimiter,
  body: SpeechRequestSchema,
  maxBytes: 16 * 1024,
  handler: async ({ body, fail, log }) => {
    const claim = verifySpeech(body.speechToken);
    if (!claim) return fail("invalid_speech_token", 401);

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return fail("tts_not_configured", 501); // the client falls back on this status
    assertProviderAllowed("tts", "elevenlabs");

    try {
      const client = new ElevenLabsClient({ apiKey });
      const stream = await client.textToSpeech.convert(VOICE_ID, {
        text: claim.text,
        modelId: "eleven_turbo_v2_5",
        voiceSettings: {
          stability:        0.45,
          similarityBoost:  0.75,
          style:            0.35,
          useSpeakerBoost:  true,
        },
      });

      // Pipe stream directly — no server-side buffering, client receives chunks
      // as ElevenLabs generates them for lower time-to-first-audio.
      return new NextResponse(stream as unknown as ReadableStream, {
        headers: { "Content-Type": "audio/mpeg" },
      });
    } catch (error) {
      log.error("provider.failed", {
        provider: "elevenlabs",
        errorName: error instanceof Error ? error.name : "Unknown",
      });
      return fail("upstream_error", 502);
    }
  },
});
