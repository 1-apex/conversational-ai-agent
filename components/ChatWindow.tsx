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

// Strip markdown and emoji so TTS speaks naturally
function toSpeakable(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")   // **bold** → bold
    .replace(/[^\x00-\xFFFF]/g, " ")   // emoji / non-BMP → space
    .replace(/\n+/g, ". ")             // newlines → natural pause
    .replace(/\.\s*\.\s*/g, ". ")      // collapse double periods
    .replace(/\s{2,}/g, " ")           // collapse whitespace
    .trim();
}

const INITIAL_STATE: ConversationState = { step: "greeting", patientInfo: {} };

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationState, setConversationState] = useState<ConversationState>(INITIAL_STATE);
  const [isTyping, setIsTyping] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [typingMsgId, setTypingMsgId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const animTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Stores full reply text so mute() can flush the partial message immediately
  const pendingMsgRef = useRef<{ id: string; fullContent: string } | null>(null);

  // Slot ChatInput fills with its startListening() function.
  // ChatWindow calls it after TTS ends when voice mode is on.
  const listenTriggerRef = useRef<(() => void) | null>(null);

  // Ref-synced copy of voiceMode so the async utterance.onend closure
  // always reads the current toggle value, not a stale closure capture.
  const voiceModeRef = useRef(false);
  useEffect(() => { voiceModeRef.current = voiceMode; }, [voiceMode]);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      synthRef.current = window.speechSynthesis;
    }
  }, []);

  // Auto-scroll to newest message
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  // Trigger initial greeting on mount
  useEffect(() => {
    sendToAPI("", INITIAL_STATE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearAnimTimer() {
    if (animTimerRef.current) {
      clearInterval(animTimerRef.current);
      animTimerRef.current = null;
    }
  }

  function speak(text: string, msgId: string, words: string[]) {
    const msPerWord = Math.round(1000 / (2.5 * 1.05));

    function startWordTimer() {
      let wordIdx = 0;
      animTimerRef.current = setInterval(() => {
        wordIdx++;
        const partial = words.slice(0, wordIdx).join(" ");
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, content: partial } : m))
        );
        if (wordIdx >= words.length) {
          clearAnimTimer();
          setTypingMsgId(null);
          pendingMsgRef.current = null;
        }
      }, msPerWord);
    }

    if (!synthRef.current) {
      // No speech synthesis — reveal text immediately
      startWordTimer();
      return;
    }

    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(toSpeakable(text));
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const voices = synthRef.current.getVoices();
    const preferred = voices.find(
      (v) =>
        v.lang.startsWith("en") &&
        (v.name.includes("Google") ||
          v.name.includes("Samantha") ||
          v.name.includes("Karen") ||
          v.name.includes("Zira"))
    );
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => {
      setIsSpeaking(true);
      startWordTimer(); // text reveals only when audio actually begins
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      if (voiceModeRef.current) {
        setTimeout(() => listenTriggerRef.current?.(), 300);
      }
    };
    utterance.onerror = () => setIsSpeaking(false);

    synthRef.current.speak(utterance);
  }

  function flushPendingMsg() {
    if (!pendingMsgRef.current) return;
    const { id, fullContent } = pendingMsgRef.current;
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, content: fullContent } : m))
    );
    pendingMsgRef.current = null;
    clearAnimTimer();
    setTypingMsgId(null);
  }

  function mute() {
    synthRef.current?.cancel();
    flushPendingMsg();
    setIsSpeaking(false);
  }

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

      // Simulate typing delay; remove this once a real LLM is wired in
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 800));

      const msgId = generateId();
      const words = data.reply.trim().split(/\s+/).filter(Boolean);

      // Add message with empty content — speak() fills it word by word
      // only once audio actually starts (utterance.onstart)
      setMessages((prev) => [
        ...prev,
        { id: msgId, role: "assistant", content: "", timestamp: Date.now() },
      ]);
      setConversationState(data.conversationState);
      setTypingMsgId(msgId);
      pendingMsgRef.current = { id: msgId, fullContent: data.reply };

      speak(data.reply, msgId, words);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  }

  function handleSend(text: string) {
    mute(); // stop TTS whenever the user sends a new message
    setMessages((prev) => [
      ...prev,
      { id: generateId(), role: "user", content: text, timestamp: Date.now() },
    ]);
    sendToAPI(text, conversationState);
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="glass-panel border-b border-white/20 px-6 py-4 shrink-0">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          {/* Logo */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
            C
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-800">CareLink</h1>
            <p className="text-xs text-gray-500">AI Scheduling Assistant</p>
          </div>

          {/* Speaking indicator — visible only while TTS is active */}
          {isSpeaking && (
            <div className="flex items-center gap-2 animate-fade-in">
              <div className="waveform" aria-label="Assistant is speaking">
                <span /><span /><span /><span />
              </div>
              <button
                type="button"
                onClick={mute}
                aria-label="Stop speaking"
                className="text-xs text-gray-400 hover:text-red-500 transition-colors px-1"
              >
                Mute
              </button>
            </div>
          )}

          {/* Right-side controls */}
          <div className="ml-auto flex items-center gap-3">
            {/* Hands-free toggle */}
            <button
              type="button"
              onClick={() => setVoiceMode((v) => !v)}
              aria-pressed={voiceMode}
              aria-label={voiceMode ? "Disable hands-free mode" : "Enable hands-free mode"}
              title={
                voiceMode
                  ? "Hands-free ON — mic reopens automatically after each reply"
                  : "Enable hands-free mode"
              }
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border transition-all ${
                voiceMode
                  ? "bg-teal-500 text-white border-teal-500 shadow-sm"
                  : "bg-white/60 text-gray-500 border-white/30 hover:border-teal-400/50 hover:text-teal-600"
              }`}
            >
              {/* Headphones icon */}
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z" />
                <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
              </svg>
              {voiceMode ? "Hands-free" : "Voice"}
            </button>

            {/* Online indicator */}
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-gray-500">Online</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Messages ────────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              showCursor={typingMsgId === msg.id}
            />
          ))}
          {isTyping && <TypingIndicator />}
        </div>
      </div>

      {/* ── Voice escalation ─────────────────────────────────────── */}
      <VoiceEscalation hasMessages={messages.length > 0} />

      {/* ── Input ────────────────────────────────────────────────── */}
      <ChatInput
        onSend={handleSend}
        disabled={isTyping}
        isSpeaking={isSpeaking}
        listenTriggerRef={listenTriggerRef}
      />
    </div>
  );
}
