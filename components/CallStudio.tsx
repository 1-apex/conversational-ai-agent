"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  CallStatus, AgentName, AgentState, AgentTurn, AgentApiResponse, CallBriefData,
} from "@/lib/types";
import { EMPTY_ENTITY_MAP } from "@/lib/entity-extractor";
import { AGENT_META } from "./AgentBadge";
import AgentBadge from "./AgentBadge";
import AgentTranscript from "./AgentTranscript";
import CubePulse from "./CubePulse";
import CallBrief from "./CallBrief";

// ── SpeechRecognition type declarations ───────────────────────────────────
interface SRAlternative { readonly transcript: string; }
interface SRResult { readonly isFinal: boolean; readonly length: number; readonly [i: number]: SRAlternative; }
interface SRResultList { readonly length: number; readonly [i: number]: SRResult; }
interface SREvent extends Event { readonly results: SRResultList; }
interface SpeechRecognitionInstance {
  continuous: boolean; interimResults: boolean; lang: string;
  onresult: ((e: SREvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: Event) => void) | null;
  start(): void; stop(): void; abort(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;
type WindowWithSpeech = Window & {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
};

// ── TTS voice config per agent ────────────────────────────────────────────
const VOICE_CONFIG: Record<AgentName, { rate: number; pitch: number; voiceIndex: number }> = {
  orchestrator: { rate: 1.00, pitch: 1.00, voiceIndex: 0 },
  sales:        { rate: 1.05, pitch: 1.06, voiceIndex: 1 },
  product:      { rate: 0.95, pitch: 0.88, voiceIndex: 2 },
  general:      { rate: 1.00, pitch: 1.10, voiceIndex: 3 },
  b2b:          { rate: 0.93, pitch: 0.82, voiceIndex: 4 },
};

// ── Helpers ───────────────────────────────────────────────────────────────
function genId() { return Math.random().toString(36).substring(2, 10); }
function fmtTime(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
function toSpeakable(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/[^\x00-\xFFFF]/g, " ")
    .replace(/\n+/g, ". ")
    .replace(/\.\s*\.\s*/g, ". ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export default function CallStudio() {
  const [status,       setStatus]       = useState<CallStatus>("idle");
  const [agentState,   setAgentState]   = useState<AgentState>("idle");
  const [activeAgent,  setActiveAgent]  = useState<AgentName>("orchestrator");
  const [turns,        setTurns]        = useState<AgentTurn[]>([]);
  const [interimText,  setInterimText]  = useState("");
  const [elapsed,      setElapsed]      = useState(0);
  const [brief,        setBrief]        = useState<CallBriefData | null>(null);
  const [briefError,   setBriefError]   = useState("");

  // Refs for async-safe access
  const isActiveRef     = useRef(false);
  const agentStateRef   = useRef<AgentState>("idle");
  const activeAgentRef  = useRef<AgentName>("orchestrator");
  const turnsRef        = useRef<AgentTurn[]>([]);
  const finalTextRef    = useRef("");
  const startTimeRef    = useRef(0);
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef  = useRef<SpeechRecognitionInstance | null>(null);
  const synthRef        = useRef<SpeechSynthesis | null>(null);
  const voicesRef       = useRef<SpeechSynthesisVoice[]>([]);

  // Sync state → refs
  useEffect(() => { agentStateRef.current  = agentState;  }, [agentState]);
  useEffect(() => { activeAgentRef.current = activeAgent; }, [activeAgent]);
  useEffect(() => { turnsRef.current       = turns;       }, [turns]);

  // ── TTS: speak a reply as the given agent ──────────────────────────────
  const speak = useCallback((text: string, agent: AgentName) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(toSpeakable(text));
    const cfg = VOICE_CONFIG[agent];
    utterance.rate   = cfg.rate;
    utterance.pitch  = cfg.pitch;
    utterance.volume = 1;

    // Assign a different English voice per agent when available
    const enVoices = voicesRef.current.filter((v) => v.lang.startsWith("en"));
    if (enVoices.length > 0) {
      utterance.voice = enVoices[cfg.voiceIndex % enVoices.length];
    }

    setAgentState("speaking");
    agentStateRef.current = "speaking";

    utterance.onend = utterance.onerror = () => {
      if (!isActiveRef.current) return;
      setAgentState("listening");
      agentStateRef.current = "listening";
      startListening();
    };

    synthRef.current.speak(utterance);
  }, []); // stable — reads from refs

  // ── STT: listen for one user turn ──────────────────────────────────────
  function startListening() {
    if (!isActiveRef.current) return;
    const w = window as WindowWithSpeech;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;

    finalTextRef.current = "";
    setInterimText("");

    const rec = new Ctor();
    rec.continuous     = false;
    rec.interimResults = true;
    rec.lang           = "en-US";

    rec.onresult = (event: SREvent) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript;
      setInterimText(transcript);
      if (event.results[event.results.length - 1].isFinal) {
        finalTextRef.current = transcript.trim();
        setInterimText("");
      }
    };

    rec.onend = () => {
      recognitionRef.current = null;
      const text = finalTextRef.current;
      if (text && isActiveRef.current) {
        finalTextRef.current = "";
        callAgent(text);
      } else if (isActiveRef.current && agentStateRef.current === "listening") {
        // silence — restart listening after a short pause
        setTimeout(() => {
          if (isActiveRef.current && agentStateRef.current === "listening") startListening();
        }, 400);
      }
    };

    rec.onerror = (event: Event) => {
      const e = event as Event & { error?: string };
      if (e.error !== "aborted" && isActiveRef.current && agentStateRef.current === "listening") {
        setTimeout(() => {
          if (isActiveRef.current && agentStateRef.current === "listening") startListening();
        }, 400);
      }
    };

    recognitionRef.current = rec;
    try { rec.start(); } catch { /* already started */ }
  }

  // ── Core agent call ────────────────────────────────────────────────────
  const callAgent = useCallback(async (userInput: string) => {
    if (!isActiveRef.current) return;

    // Add user turn to history (skip on greeting trigger)
    let snapshot = turnsRef.current;
    if (userInput) {
      const userTurn: AgentTurn = { id: genId(), role: "user", content: userInput, timestamp: Date.now() };
      snapshot = [...snapshot, userTurn];
      setTurns(snapshot);
      turnsRef.current = snapshot;
    }

    setAgentState("thinking");
    agentStateRef.current = "thinking";

    try {
      const res = await fetch("/api/agent", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history:      snapshot,
          userInput,
          currentAgent: activeAgentRef.current,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as AgentApiResponse;

      // Switch agent if handoff requested
      const effectiveAgent = data.handoff ?? data.agent;
      if (effectiveAgent !== activeAgentRef.current) {
        setActiveAgent(effectiveAgent);
        activeAgentRef.current = effectiveAgent;
      }

      // Add agent turn
      const agentTurn: AgentTurn = {
        id: genId(), role: "agent", content: data.reply,
        agent: effectiveAgent, timestamp: Date.now(),
      };
      const withAgent = [...turnsRef.current, agentTurn];
      setTurns(withAgent);
      turnsRef.current = withAgent;

      speak(data.reply, effectiveAgent);
    } catch (err) {
      console.error("Agent call failed:", err);
      // recover — open mic again
      setAgentState("listening");
      agentStateRef.current = "listening";
      startListening();
    }
  }, [speak]);

  // ── Call lifecycle ─────────────────────────────────────────────────────
  const startCall = useCallback(async () => {
    // Reset
    setTurns([]);           turnsRef.current       = [];
    setActiveAgent("orchestrator"); activeAgentRef.current = "orchestrator";
    setBrief(null);         setBriefError("");
    setElapsed(0);          finalTextRef.current   = "";

    isActiveRef.current = true;
    setStatus("active");
    setAgentState("thinking");
    agentStateRef.current = "thinking";

    // Timer
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(
      () => setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000)),
      1000
    );

    // Init TTS
    synthRef.current = window.speechSynthesis;
    const existing = synthRef.current.getVoices();
    if (existing.length > 0) {
      voicesRef.current = existing;
    } else {
      await new Promise<void>((resolve) => {
        const h = () => { voicesRef.current = synthRef.current!.getVoices(); resolve(); };
        synthRef.current!.addEventListener("voiceschanged", h, { once: true });
        setTimeout(resolve, 1200);
      });
    }

    // Trigger greeting
    await callAgent("");
  }, [callAgent]);

  const endCall = useCallback(async () => {
    isActiveRef.current = false;
    setAgentState("idle");
    agentStateRef.current = "idle";
    setStatus("ending");

    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);

    recognitionRef.current?.abort();
    recognitionRef.current = null;
    synthRef.current?.cancel();
    setInterimText("");

    const currentTurns = turnsRef.current;

    // Convert AgentTurn[] to TranscriptTurn format for the brief endpoint
    const briefTurns = currentTurns.map((t) => ({
      id: t.id, speaker: t.role === "agent" ? "agent" : "prospect" as "agent" | "prospect",
      text: t.content, timestamp: t.timestamp, entities: EMPTY_ENTITY_MAP,
    }));

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turns: briefTurns, duration }),
      });
      if (!res.ok) throw new Error(await res.text());
      setBrief((await res.json()) as CallBriefData);
    } catch (err) {
      setBriefError(err instanceof Error ? err.message : "Brief generation failed");
    }
    setStatus("done");
  }, []);

  const handleNewCall = useCallback(() => {
    setStatus("idle");   setBrief(null);     setBriefError("");
    setTurns([]);        setElapsed(0);      setActiveAgent("orchestrator");
    setAgentState("idle");
  }, []);

  // Cleanup on unmount
  useEffect(() => () => {
    isActiveRef.current = false;
    recognitionRef.current?.abort();
    synthRef.current?.cancel();
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const agentMeta = AGENT_META[activeAgent];
  const isEnding  = status === "ending";

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="glass-panel border-b border-white/20 px-6 py-3 shrink-0">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 transition-all ${agentMeta.dot}`}>
            {activeAgent[0].toUpperCase()}
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-800 leading-tight">CareLink</h1>
            <p className="text-[11px] text-gray-400">AI Call Agent — Inogen</p>
          </div>

          {status === "active" && (
            <AgentBadge agent={activeAgent} state={agentState} />
          )}

          <div className="ml-auto flex items-center gap-4">
            {(status === "active" || status === "ending" || status === "done") && (
              <span className="font-mono text-sm text-gray-600 tabular-nums">{fmtTime(elapsed)}</span>
            )}
            {status === "active" && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs text-red-600 font-medium">Live</span>
                </div>
                <button
                  onClick={endCall}
                  className="text-xs px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-all"
                >
                  End Call
                </button>
              </>
            )}
            {status === "ending" && <span className="text-xs text-gray-400">Generating brief…</span>}
            {status === "done"   && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-xs text-emerald-600 font-medium">Brief ready</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden max-w-6xl w-full mx-auto">

        {/* Left — Sphere */}
        <div className="w-2/5 flex flex-col items-center justify-center gap-5 p-8 border-r border-white/20">
          <CubePulse agentState={agentState} />

          <div className="text-center space-y-1.5">
            {status === "idle" && (
              <>
                <p className="text-sm text-gray-500">Agent ready</p>
                <button
                  onClick={startCall}
                  className="mt-2 px-8 py-3 bg-linear-to-r from-teal-500 to-cyan-500 text-white rounded-xl font-medium text-sm hover:from-teal-600 hover:to-cyan-600 transition-all shadow-lg shadow-teal-500/25 active:scale-95"
                >
                  Start Call
                </button>
              </>
            )}
            {status === "active" && (
              <p className={`text-sm font-medium transition-all ${
                agentState === "speaking"  ? "text-teal-600"
              : agentState === "listening" ? "text-violet-600"
              : "text-gray-400"
              }`}>
                {agentState === "thinking"  ? "Thinking…"
               : agentState === "speaking"  ? `${AGENT_META[activeAgent].label} speaking…`
               : agentState === "listening" ? "Listening…"
               : ""}
              </p>
            )}
            {status === "ending" && <p className="text-sm text-gray-400">Processing…</p>}
            {status === "done"   && <p className="text-sm text-gray-500">Call ended</p>}
          </div>
        </div>

        {/* Right — Transcript / Brief */}
        <div className="w-3/5 flex flex-col overflow-hidden">
          {status === "done" && brief ? (
            <CallBrief brief={brief} onNewCall={handleNewCall} />
          ) : status === "done" && briefError ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
              <p className="text-sm text-red-500">{briefError}</p>
              <button onClick={handleNewCall} className="text-xs text-teal-600 underline">Start new call</button>
            </div>
          ) : isEnding ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3">
                <div className="waveform"><span /><span /><span /><span /></div>
                <p className="text-sm text-gray-500">Analyzing conversation…</p>
              </div>
            </div>
          ) : (
            <AgentTranscript
              turns={turns}
              interimText={interimText}
              agentState={agentState}
              activeAgent={activeAgent}
            />
          )}
        </div>
      </div>
    </div>
  );
}
