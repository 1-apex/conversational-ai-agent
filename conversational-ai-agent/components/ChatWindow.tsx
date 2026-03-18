"use client";

import { useState, useEffect, useRef } from "react";
import { Message, ConversationState, ChatResponse } from "@/lib/types";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import TypingIndicator from "./TypingIndicator";
import VoiceEscalation from "./VoiceEscalation";

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

const INITIAL_STATE: ConversationState = {
  step: "greeting",
  patientInfo: {},
};

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationState, setConversationState] = useState<ConversationState>(INITIAL_STATE);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isTyping]);

  // Trigger initial greeting on mount
  useEffect(() => {
    sendToAPI("", INITIAL_STATE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendToAPI(message: string, state: ConversationState) {
    setIsTyping(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, conversationState: state }),
      });

      if (!res.ok) throw new Error("API error");

      const data: ChatResponse = await res.json();

      // Simulate typing delay for realism
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 800));

      const assistantMsg: Message = {
        id: generateId(),
        role: "assistant",
        content: data.reply,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setConversationState(data.conversationState);
    } catch (err) {
      console.error("Chat error:", err);
      const errorMsg: Message = {
        id: generateId(),
        role: "assistant",
        content: "Sorry, something went wrong. Please try again.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  }

  function handleSend(text: string) {
    const userMsg: Message = {
      id: generateId(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    sendToAPI(text, conversationState);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="glass-panel border-b border-white/20 px-6 py-4 shrink-0">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
            K
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-800">Kyron Medical</h1>
            <p className="text-xs text-gray-500">AI Scheduling Assistant</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-gray-500">Online</span>
          </div>
        </div>
      </header>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {isTyping && <TypingIndicator />}
        </div>
      </div>

      {/* Voice escalation */}
      <VoiceEscalation hasMessages={messages.length > 0} />

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={isTyping} />
    </div>
  );
}

