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
  const isActiveRef       = useRef(false);
  const agentStateRef     = useRef<AgentState>("idle");
  const activeAgentRef    = useRef<AgentName>("orchestrator");
  const turnsRef          = useRef<AgentTurn[]>([]);
  const finalTextRef      = useRef("");
  const accumulatedTextRef = useRef("");
  const processingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef      = useRef(0);
  const timerRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef    = useRef<SpeechRecognitionInstance | null>(null);
  const currentAudioRef   = useRef<HTMLAudioElement | null>(null);
  const silenceWatcherRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSpeechTimeRef = useRef(0);
  const checkinCountRef   = useRef(0);
  const CHECKIN_AFTER_MS  = 8000; // silence threshold before "are you still there?"

  // Sync state → refs
  useEffect(() => { agentStateRef.current  = agentState;  }, [agentState]);
  useEffect(() => { activeAgentRef.current = activeAgent; }, [activeAgent]);
  useEffect(() => { turnsRef.current       = turns;       }, [turns]);

  // ── Stop any in-progress TTS immediately ──────────────────────────────
  function mute() {
    if (currentAudioRef.current) {
      const audio = currentAudioRef.current;
      audio.onended = null; // prevent fallback triggering after forced stop
      audio.onerror = null;
      audio.pause();
      audio.src = "";
      currentAudioRef.current = null;
    }
    window.speechSynthesis?.cancel();
  }

  // ── Silence watcher — fires a check-in if user goes quiet too long ───────
  function clearSilenceWatcher() {
    if (silenceWatcherRef.current) {
      clearInterval(silenceWatcherRef.current);
      silenceWatcherRef.current = null;
    }
  }

  function armSilenceWatcher() {
    if (silenceWatcherRef.current) return; // already armed
    lastSpeechTimeRef.current = Date.now();
    silenceWatcherRef.current = setInterval(() => {
      if (!isActiveRef.current || agentStateRef.current !== "listening") {
        clearSilenceWatcher();
        return;
      }
      if (Date.now() - lastSpeechTimeRef.current < CHECKIN_AFTER_MS) return;

      checkinCountRef.current++;
      lastSpeechTimeRef.current = Date.now(); // prevent re-fire until next interval
      clearSilenceWatcher();

      if (checkinCountRef.current > 2) return; // 3 unanswered check-ins — give up

      const msg = checkinCountRef.current === 1
        ? "Just checking — are you still there?"
        : "No worries, take your time. I'm here whenever you're ready.";

      const checkInTurn: AgentTurn = {
        id: genId(), role: "agent", content: msg,
        agent: activeAgentRef.current, timestamp: Date.now(),
      };
      setTurns((prev) => [...prev, checkInTurn]);
      turnsRef.current = [...turnsRef.current, checkInTurn];
      speak(msg, activeAgentRef.current); // onEnd → startListening → re-arms watcher
    }, 1000);
  }

  // ── Web Speech fallback (ElevenLabs error recovery only) ─────────────────
  function webSpeechFallback(text: string, onEnd: () => void) {
    const synth = window.speechSynthesis;
    if (!synth) { onEnd(); return; }
    synth.cancel();
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.volume = 1;
      const voices = synth.getVoices();
      const voice =
        voices.find((v) => v.default && v.lang.startsWith("en") && v.localService) ??
        voices.find((v) => v.lang === "en-US" && v.localService) ??
        voices.find((v) => v.lang.startsWith("en") && v.localService) ??
        voices.find((v) => v.lang.startsWith("en"));
      if (voice) utterance.voice = voice;
      let fired = false;
      const safeEnd = () => { if (!fired) { fired = true; onEnd(); } };
      utterance.onend   = safeEnd;
      utterance.onerror = safeEnd;
      setTimeout(safeEnd, Math.max(3000, text.split(/\s+/).length * 400));
      if (synth.paused) synth.resume();
      synth.speak(utterance);
    }, 50);
  }

  // ── TTS: try ElevenLabs first, fall back to Web Speech ─────────────────
  const speak = useCallback(async (text: string, agent: AgentName, afterSpeak?: () => void) => {
    mute();
    setAgentState("speaking");
    agentStateRef.current = "speaking";

    const cleaned = toSpeakable(text);
    const onEnd = () => {
      if (!isActiveRef.current) return;
      if (afterSpeak) {
        afterSpeak();
      } else {
        setAgentState("listening");
        agentStateRef.current = "listening";
        startListening();
      }
    };

    try {
      const controller = new AbortController();
      const ttsTimeout = setTimeout(() => controller.abort(), 4000); // fail fast if ElevenLabs hangs

      const res = await fetch("/api/tts", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text: cleaned, agent }),
        signal:  controller.signal,
      });
      clearTimeout(ttsTimeout);

      if (res.status === 501) throw new Error("no-key"); // no ElevenLabs key → fall back
      if (!res.ok) throw new Error(`tts-${res.status}`);

      const blob  = await res.blob();
      const url   = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        if (currentAudioRef.current === audio) currentAudioRef.current = null;
        onEnd();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        if (currentAudioRef.current === audio) currentAudioRef.current = null;
        webSpeechFallback(cleaned, onEnd);
      };

      await audio.play().catch(() => webSpeechFallback(cleaned, onEnd));
    } catch {
      webSpeechFallback(cleaned, onEnd);
    }
  }, []); // stable — reads state via refs

  // How long after the last speech chunk to wait before sending to the agent.
  // Gives the user time to pause mid-sentence and continue naturally.
  const SPEECH_SILENCE_MS = 1600;

  // ── STT: listen continuously, accumulate across sessions, debounce send ──
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
      // User is speaking — reset silence tracking
      lastSpeechTimeRef.current = Date.now();
      checkinCountRef.current = 0;

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
      const chunk = finalTextRef.current;
      finalTextRef.current = "";

      if (chunk && isActiveRef.current) {
        // Append to anything already said in this turn
        accumulatedTextRef.current = (accumulatedTextRef.current + " " + chunk).trim();

        // Reset the silence timer — user may still be mid-sentence
        if (processingTimerRef.current) clearTimeout(processingTimerRef.current);
        processingTimerRef.current = setTimeout(() => {
          processingTimerRef.current = null;
          const full = accumulatedTextRef.current;
          if (full && isActiveRef.current && agentStateRef.current === "listening") {
            accumulatedTextRef.current = "";
            setInterimText("");
            callAgent(full);
          }
        }, SPEECH_SILENCE_MS);

        // Restart immediately so we catch the continuation
        setTimeout(() => {
          if (isActiveRef.current && agentStateRef.current === "listening") startListening();
        }, 120);
      } else if (isActiveRef.current && agentStateRef.current === "listening") {
        // Pure silence — restart
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
    try {
      rec.start();
      armSilenceWatcher(); // start counting silence from now
    } catch {
      setTimeout(() => {
        if (isActiveRef.current && agentStateRef.current === "listening") startListening();
      }, 500);
    }
  }

  // ── Core agent call ────────────────────────────────────────────────────
  const callAgent = useCallback(async (userInput: string) => {
    if (!isActiveRef.current) return;

    // Cancel any pending speech/silence timers
    clearSilenceWatcher();
    if (processingTimerRef.current) { clearTimeout(processingTimerRef.current); processingTimerRef.current = null; }
    accumulatedTextRef.current = "";
    recognitionRef.current?.abort();
    recognitionRef.current = null;

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
      const isHandoff = !!data.handoff && data.handoff !== activeAgentRef.current;
      if (isHandoff) {
        setActiveAgent(data.handoff!);
        activeAgentRef.current = data.handoff!;
      }

      // Save turn attributed to whoever actually generated it (data.agent = orchestrator,
      // not the new agent) so history stays coherent for the incoming agent
      const agentTurn: AgentTurn = {
        id: genId(), role: "agent", content: data.reply,
        agent: data.agent, timestamp: Date.now(),
      };
      const withAgent = [...turnsRef.current, agentTurn];
      setTurns(withAgent);
      turnsRef.current = withAgent;

      if (isHandoff) {
        // Speak the transition message, then immediately trigger a greeting
        // from the new agent so it can introduce itself before listening
        speak(data.reply, data.agent, () => {
          if (isActiveRef.current) callAgent("");
        });
      } else {
        speak(data.reply, data.agent);
      }
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
    setTurns([]);           turnsRef.current        = [];
    setActiveAgent("orchestrator"); activeAgentRef.current = "orchestrator";
    setBrief(null);         setBriefError("");
    setElapsed(0);          finalTextRef.current    = "";
    accumulatedTextRef.current = "";
    if (processingTimerRef.current) { clearTimeout(processingTimerRef.current); processingTimerRef.current = null; }

    checkinCountRef.current = 0;
    lastSpeechTimeRef.current = Date.now();
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

    if (processingTimerRef.current) { clearTimeout(processingTimerRef.current); processingTimerRef.current = null; }
    accumulatedTextRef.current = "";
    clearSilenceWatcher();
    mute();
    recognitionRef.current?.abort();
    recognitionRef.current = null;
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
    mute();
    clearSilenceWatcher();
    recognitionRef.current?.abort();
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
