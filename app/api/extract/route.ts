import { NextRequest, NextResponse } from "next/server";
import { TranscriptTurn } from "@/lib/types";
import { generateRuleBrief } from "@/lib/rule-brief";

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { turns, duration } = body as { turns?: unknown; duration?: unknown };

    if (!Array.isArray(turns) || turns.length === 0) {
      return NextResponse.json({ error: "turns must be a non-empty array" }, { status: 400 });
    }

    const castedTurns = turns as TranscriptTurn[];
    const secs        = Number(duration ?? 0);

    // ── AI extraction (when a key is configured) ─────────────────────────
    // Swap the comment below to enable the provider you have a key for.
    // The import is dynamic so the server never crashes on missing keys.

    if (process.env.ANTHROPIC_API_KEY) {
      const { extractCallBrief } = await import("@/lib/claude-client");
      const brief = await extractCallBrief(castedTurns, secs);
      return NextResponse.json(brief);
    }

    if (process.env.GROQ_API_KEY ?? process.env.GROK_API) {
      const { extractWithGroq } = await import("@/lib/groq-client");
      const brief = await extractWithGroq(castedTurns, secs);
      return NextResponse.json(brief);
    }

    // GEMINI: uncomment when GEMINI_API_KEY is in .env
    // if (process.env.GEMINI_API_KEY) {
    //   const { extractWithGemini } = await import("@/lib/gemini-client");
    //   const brief = await extractWithGemini(castedTurns, secs);
    //   return NextResponse.json(brief);
    // }

    // ── Rule-based fallback (no API key required) ─────────────────────────
    const brief = generateRuleBrief(castedTurns, secs);
    return NextResponse.json(brief);
  } catch (error) {
    console.error("Extract error:", error instanceof Error ? error.message : "Unknown");
    return NextResponse.json({ error: "Extraction failed" }, { status: 500 });
  }
}
