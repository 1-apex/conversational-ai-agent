import { NextRequest, NextResponse } from "next/server";
import { ChatRequest, ChatResponse, ConversationState } from "@/lib/types";
import { processMessage } from "@/lib/chat-engine";

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequest = await req.json();
    const { message, conversationState } = body;

    if (!message && conversationState.step !== "greeting") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const response: ChatResponse = processMessage(message, conversationState);

    return NextResponse.json(response);
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

