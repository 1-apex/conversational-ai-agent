import { NextRequest, NextResponse } from "next/server";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { ttsLimiter, getIp } from "@/lib/rate-limit";

const VOICE_ID = "StsEnVb0Dmu25FGnhzqO";

export async function POST(req: NextRequest) {
  const { success } = await ttsLimiter.limit(getIp(req));
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.warn("[tts] ELEVENLABS_API_KEY not set");
    return NextResponse.json({ error: "ELEVENLABS_API_KEY not configured" }, { status: 501 });
  }

  try {
    const body = (await req.json()) as { text?: string };
    if (!body.text) return NextResponse.json({ error: "text required" }, { status: 400 });

    const client = new ElevenLabsClient({ apiKey });
    const stream = await client.textToSpeech.convert(VOICE_ID, {
      text: body.text,
      modelId: "eleven_turbo_v2_5",
      voiceSettings: {
        stability:        0.45,
        similarityBoost:  0.75,
        style:            0.35,
        useSpeakerBoost:  true,
      },
    });

    const arrayBuffer = await new Response(stream).arrayBuffer();
    const audio = Buffer.from(arrayBuffer);

    return new NextResponse(audio, {
      headers: { "Content-Type": "audio/mpeg" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[tts] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
