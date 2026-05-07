"use client";

import { useState, useRef, useEffect } from "react";

// SpeechRecognition and its event types are absent from some TS DOM lib
// versions — declare the minimal surface area we actually use.
interface SRAlternative {
  readonly transcript: string;
}
interface SRResult {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: SRAlternative;
}
interface SRResultList {
  readonly length: number;
  readonly [index: number]: SRResult;
}
interface SREvent extends Event {
  readonly results: SRResultList;
}
interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SREvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: Event) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

type WindowWithSpeech = Window & {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
};

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Keep a ref to onSend so the recognition handler always calls the latest
  // version without needing to re-create the SpeechRecognition instance.
  const onSendRef = useRef(onSend);
  useEffect(() => { onSendRef.current = onSend; }, [onSend]);

  // Holds the final transcript between isFinal result and the auto-send
  // timeout, so we can cancel it if the user clicks Stop before it fires.
  const pendingRef = useRef("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const w = window as WindowWithSpeech;
    const RecognitionCtor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!RecognitionCtor) return;

    setSpeechSupported(true);

    const rec = new RecognitionCtor();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (event: SREvent) => {
      // Build full transcript from all result fragments
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }

      setInput(transcript);

      if (event.results[event.results.length - 1].isFinal) {
        const final = transcript.trim();
        pendingRef.current = final;
        // 400 ms pause so the user can see what was captured before it sends
        setTimeout(() => {
          if (pendingRef.current) {
            onSendRef.current(pendingRef.current);
            setInput("");
            pendingRef.current = "";
          }
        }, 400);
      }
    };

    rec.onend = () => setIsListening(false);

    rec.onerror = () => {
      setIsListening(false);
      pendingRef.current = "";
    };

    recognitionRef.current = rec;

    return () => rec.abort();
  }, []);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput("");
    inputRef.current?.focus();
  };

  const toggleListening = () => {
    if (!recognitionRef.current || disabled) return;
    if (isListening) {
      recognitionRef.current.stop();
      pendingRef.current = "";
    } else {
      setInput("");
      pendingRef.current = "";
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  return (
    <div className="glass-panel border-t border-white/20 p-4">
      <div className="flex gap-2 max-w-3xl mx-auto">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={isListening ? "Listening…" : "Type your message…"}
          disabled={disabled}
          maxLength={500}
          aria-label="Chat message"
          className={`flex-1 bg-white/60 backdrop-blur-sm border rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 outline-none focus:ring-2 transition-all disabled:opacity-50 ${
            isListening
              ? "border-red-400/60 ring-2 ring-red-400/25 placeholder-red-400"
              : "border-white/30 focus:ring-teal-400/50 focus:border-teal-400/50"
          }`}
        />

        {speechSupported && (
          <button
            type="button"
            onClick={toggleListening}
            disabled={disabled}
            aria-label={isListening ? "Stop recording" : "Record voice message"}
            aria-pressed={isListening}
            title={isListening ? "Stop recording" : "Speak your message"}
            className={`flex items-center justify-center w-12 h-12 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 ${
              isListening
                ? "bg-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse"
                : "bg-white/60 border border-white/30 text-gray-500 hover:bg-white/80 hover:text-teal-600"
            }`}
          >
            {isListening ? (
              /* Stop square */
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              /* Microphone */
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          aria-label="Send message"
          className="bg-linear-to-r from-teal-500 to-cyan-500 text-white px-6 py-3 rounded-xl text-sm font-medium hover:from-teal-600 hover:to-cyan-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 shrink-0"
        >
          Send
        </button>
      </div>

      {isListening && (
        <p className="max-w-3xl mx-auto mt-2 text-xs text-red-500 text-center animate-fade-in">
          Listening — speak now, or click stop to cancel.
        </p>
      )}
    </div>
  );
}
