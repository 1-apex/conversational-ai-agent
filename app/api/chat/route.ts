import { NextRequest, NextResponse } from "next/server";
import { ChatResponse, ConversationState, ConversationStep } from "@/lib/types";
import { processMessage } from "@/lib/chat-engine";

const VALID_STEPS = new Set<ConversationStep>([
  "greeting", "collect_firstName", "collect_lastName", "collect_dob",
  "collect_phone", "collect_email", "collect_reason", "match_doctor",
  "offer_slots", "confirm_booking", "booked", "no_match", "general",
]);

function isValidConversationState(v: unknown): v is ConversationState {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.step === "string" &&
    VALID_STEPS.has(s.step as ConversationStep) &&
    s.patientInfo !== null &&
    typeof s.patientInfo === "object"
  );
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { message, conversationState } = body as Record<string, unknown>;

    if (typeof message !== "string") {
      return NextResponse.json({ error: "message must be a string" }, { status: 400 });
    }

    if (!isValidConversationState(conversationState)) {
      return NextResponse.json({ error: "Invalid conversationState" }, { status: 400 });
    }

    if (!message && conversationState.step !== "greeting") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const response: ChatResponse = processMessage(message, conversationState);
    return NextResponse.json(response);
  } catch (error) {
    // Log the message only — avoid leaking full error objects that may contain PII
    console.error("Chat API error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
