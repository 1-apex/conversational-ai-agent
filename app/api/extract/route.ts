import { NextRequest, NextResponse } from "next/server";
import { TranscriptTurn } from "@/lib/types";
import { extractCallBrief } from "@/lib/claude-client";

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

    const brief = await extractCallBrief(turns as TranscriptTurn[], Number(duration ?? 0));
    return NextResponse.json(brief);
  } catch (error) {
    console.error("Extract error:", error instanceof Error ? error.message : "Unknown");
    return NextResponse.json({ error: "Extraction failed" }, { status: 500 });
  }
}
