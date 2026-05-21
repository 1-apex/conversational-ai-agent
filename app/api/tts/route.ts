import { NextRequest, NextResponse } from "next/server";
import { AgentName } from "@/lib/types";

// ElevenLabs premade voice IDs.
// Find yours at elevenlabs.io → Voices → copy the ID next to each voice.
const VOICE_IDS: Record<AgentName, string> = {
  orchestrator: "21m00Tcm4TlvDq8ikWAM", // Rachel  — warm, professional female
  sales:        "AZnzlk1XvdvUeBnXmlld", // Domi    — energetic, younger female
  product:      "TxGEqnHWrfWFTfGW9XjX", // Josh    — deep, authoritative male
  general:      "MF3mGyEYCl7XYWbV9V6O", // Elli    — friendly, upbeat female
  b2b:          "ErXwobaYiN019PkySvjV",  // Antoni  — calm, professional male
};

// stability: lower = more expressive/variable; higher = more consistent/flat
// style:     higher = more emotion and inflection
const VOICE_SETTINGS: Record<AgentName, object> = {
  orchestrator: { stability: 0.42, similarity_boost: 0.75, style: 0.30, use_speaker_boost: true },
  sales:        { stability: 0.30, similarity_boost: 0.72, style: 0.48, use_speaker_boost: true },
  product:      { stability: 0.52, similarity_boost: 0.78, style: 0.18, use_speaker_boost: true },
  general:      { stability: 0.42, similarity_boost: 0.74, style: 0.32, use_speaker_boost: true },
  b2b:          { stability: 0.58, similarity_boost: 0.80, style: 0.12, use_speaker_boost: true },
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  // 501 = not implemented — client interprets this as "fall back to Web Speech"
  if (!apiKey) {
    return NextResponse.json({ error: "ELEVENLABS_API_KEY not configured" }, { status: 501 });
  }

  try {
    const body = (await req.json()) as { text?: string; agent?: AgentName };
    if (!body.text) return NextResponse.json({ error: "text required" }, { status: 400 });

    const agent    = body.agent ?? "orchestrator";
    const voiceId  = VOICE_IDS[agent] ?? VOICE_IDS.orchestrator;
    const settings = VOICE_SETTINGS[agent] ?? VOICE_SETTINGS.orchestrator;

    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key":   apiKey,
          "Content-Type": "application/json",
          Accept:         "audio/mpeg",
        },
        body: JSON.stringify({
          text:           body.text,
          model_id:       "eleven_turbo_v2_5", // fastest model, still natural-sounding
          voice_settings: settings,
        }),
      }
    );

    if (!upstream.ok) {
      const err = await upstream.text();
      console.error("ElevenLabs error:", upstream.status, err);
      return NextResponse.json({ error: err }, { status: upstream.status });
    }

    // Stream audio bytes straight to the browser — no buffering on the server
    return new NextResponse(upstream.body, {
      headers: { "Content-Type": "audio/mpeg" },
    });
  } catch (error) {
    console.error("TTS route error:", error instanceof Error ? error.message : "Unknown");
    return NextResponse.json({ error: "TTS failed" }, { status: 500 });
  }
}
