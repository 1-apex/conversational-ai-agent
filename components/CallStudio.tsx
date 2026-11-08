"use client";

import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import {
  CallStatus, AgentName, AgentState, AgentTurn, CallBriefData,
} from "@/lib/types";
import { NO_LIVE_STAFF_MESSAGE } from "@/lib/demo-notice";
import { EMERGENCY_MESSAGE, isEmergencyStatement } from "@/lib/emergency-offramp";
import { scoreSentiment, Sentiment } from "@/lib/sentiment";
import DemoNotice from "./DemoNotice";
import CallbackForm from "./CallbackForm";
import TypedInput from "./TypedInput";
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

// Post-process browser STT output to fix Inogen-specific misrecognitions
const TRANSCRIPT_CORRECTIONS: [RegExp, string][] = [
  [/\bocean\s+grove\b/gi,             "Inogen Rove"],
  [/\bocean\s+rove\b/gi,              "Inogen Rove"],
  [/\bin\s*a\s*gen\b/gi,              "Inogen"],
  [/\binogen\s+grove\b/gi,            "Inogen Rove"],
  [/\bgrove\s+6\b/gi,                 "Rove 6"],
  [/\bgrove\s+4\b/gi,                 "Rove 4"],
  [/\bgrove\s+3\b/gi,                 "Rove 3"],
  [/\bone\s+g\s*5\b/gi,               "One G5"],
  [/\bone\s+g\s*4\b/gi,               "One G4"],
  [/\bone\s+g\s*3\b/gi,               "One G3"],
  [/\bg\s*five\b/gi,                  "G5"],
  [/\bg\s*four\b/gi,                  "G4"],
  [/\bg\s*three\b/gi,                 "G3"],
  [/\bportable\s+oxygen\s+concentrators?\b/gi, "portable oxygen concentrator"],
  [/\bP\s*O\s*C\b/gi,                 "POC"],
];

function correctTranscript(text: string): string {
  let r = text;
  for (const [pattern, replacement] of TRANSCRIPT_CORRECTIONS) r = r.replace(pattern, replacement);
  return r;
}

interface TurnResponse {
  callToken: string;
  turnId: string;
  text: string;
  agent: AgentName;
  nextAgent: AgentName;
  pathway: string;
  handoff: boolean;
  escalationId: string | null;
  speechToken: string;
}

// ── ElevenLabs quota (localStorage, which doesn't exist during prerender) ─
const quotaListeners = new Set<() => void>();

function subscribeQuota(listener: () => void) {
  quotaListeners.add(listener);
  return () => { quotaListeners.delete(listener); };
}

function quotaKey() {
  const d = new Date();
  return `inogen_el_quota_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function readQuota() {
  const stored = parseInt(localStorage.getItem(quotaKey()) ?? "0", 10);
  return isNaN(stored) ? 0 : stored;
}

function addToQuota(chars: number) {
  localStorage.setItem(quotaKey(), String(readQuota() + chars));
  quotaListeners.forEach((listener) => listener());
}

export default function CallStudio() {
  const [status,        setStatus]         = useState<CallStatus>("idle");
  const [agentState,     setAgentState]     = useState<AgentState>("idle");
  const [activeAgent,    setActiveAgent]    = useState<AgentName>("orchestrator");
  const [turns,          setTurns]          = useState<AgentTurn[]>([]);
  const [interimText,    setInterimText]    = useState("");
  const [elapsed,        setElapsed]        = useState(0);
  const [brief,          setBrief]          = useState<CallBriefData | null>(null);
  const [briefError,     setBriefError]     = useState("");
  const quotaUsed = useSyncExternalStore(subscribeQuota, readQuota, () => 0);
  const [transferring,   setTransferring]   = useState(false);
  const [sentiment,      setSentiment]      = useState<Sentiment>("neutral");
  const [speakingTurnId, setSpeakingTurnId] = useState("");
  const [voiceError,     setVoiceError]     = useState("");
  const [escalationId,   setEscalationId]   = useState<string | null>(null);
  const [callToken,      setCallToken]      = useState("");

  const callIdRef    = useRef("");
  // Signed by the server: the browser carries the call state but can't change it
  const callTokenRef = useRef("");

  const EL_QUOTA_LIMIT = 10_000;
  const EL_QUOTA_WARN  = 8_000;

  // Refs for async-safe access
  const isActiveRef        = useRef(false);
  const agentStateRef      = useRef<AgentState>("idle");
  const activeAgentRef     = useRef<AgentName>("orchestrator");
  const turnsRef           = useRef<AgentTurn[]>([]);
  const finalTextRef       = useRef("");
  const accumulatedTextRef = useRef("");
  const processingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef       = useRef(0);
  const timerRef           = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef     = useRef<SpeechRecognitionInstance | null>(null);
  const interruptRecRef    = useRef<SpeechRecognitionInstance | null>(null);
  const currentAudioRef    = useRef<HTMLAudioElement | null>(null);
  const silenceWatcherRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSpeechTimeRef  = useRef(0);
  const checkinCountRef    = useRef(0);
  const lastAgentTextRef   = useRef("");

  // Sync state → refs
  useEffect(() => { agentStateRef.current  = agentState;  }, [agentState]);
  useEffect(() => { activeAgentRef.current = activeAgent; }, [activeAgent]);
  useEffect(() => { turnsRef.current       = turns;       }, [turns]);

  // ── Stop any in-progress TTS immediately ──────────────────────────────
  function mute() {
    if (currentAudioRef.current) {
      const audio = currentAudioRef.current;
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.src = "";
      currentAudioRef.current = null;
    }
    window.speechSynthesis?.cancel();
    stopInterruptListener();
  }

  // ── Interrupt listener — lets user speak during agent TTS ─────────────
  function stopInterruptListener() {
    interruptRecRef.current?.abort();
    interruptRecRef.current = null;
  }

  function startInterruptListener() {
    if (!isActiveRef.current) return;
    const w    = window as WindowWithSpeech;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous     = false;
    rec.interimResults = false;
    rec.lang           = "en-US";
    rec.onresult = (event: SREvent) => {
      if (agentStateRef.current !== "speaking" || !isActiveRef.current) return;
      const text  = correctTranscript(event.results[0]?.[0]?.transcript?.trim() ?? "");
      const words = text.split(/\s+/);
      if (words.length < 4) return; // too short — likely echo artifact

      // Skip if >50% of words overlap with what the agent just said
      if (lastAgentTextRef.current) {
        const agentWords = new Set(lastAgentTextRef.current.toLowerCase().split(/\s+/));
        const overlap    = words.filter(w => agentWords.has(w.toLowerCase())).length;
        if (overlap / words.length > 0.5) return;
      }

      stopInterruptListener();
      mute();
      accumulatedTextRef.current = "";
      finalTextRef.current       = "";
      callAgent(text);
    };
    rec.onend = () => {
      interruptRecRef.current = null;
      if (agentStateRef.current === "speaking" && isActiveRef.current) {
        setTimeout(() => {
          if (agentStateRef.current === "speaking" && isActiveRef.current) startInterruptListener();
        }, 500);
      }
    };
    rec.onerror = () => {
      interruptRecRef.current = null;
      if (agentStateRef.current === "speaking" && isActiveRef.current) {
        setTimeout(() => {
          if (agentStateRef.current === "speaking" && isActiveRef.current) startInterruptListener();
        }, 500);
      }
    };
    interruptRecRef.current = rec;
    try { rec.start(); } catch { /* ignore */ }
  }

  // ── Silence watcher — fires a check-in if user goes quiet too long ────
  function clearSilenceWatcher() {
    if (silenceWatcherRef.current) {
      clearInterval(silenceWatcherRef.current);
      silenceWatcherRef.current = null;
    }
  }

  function armSilenceWatcher() {
    if (silenceWatcherRef.current) return;
    lastSpeechTimeRef.current = Date.now();
    silenceWatcherRef.current = setInterval(() => {
      if (!isActiveRef.current || agentStateRef.current !== "listening") {
        clearSilenceWatcher();
        return;
      }
      if (Date.now() - lastSpeechTimeRef.current < 8000) return;

      checkinCountRef.current++;
      lastSpeechTimeRef.current = Date.now();
      clearSilenceWatcher();

      if (checkinCountRef.current >= 2) return;
      callAgent("", "silence");
    }, 1000);
  }

  // ── Web Speech fallback (ElevenLabs error recovery only) ──────────────
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
        voices.find((v) => v.lang.startsWith("en") && v.localService);
      // A remote voice would send this text to another vendor, so stay silent; the
      // text is already on screen. An empty list means voices haven't loaded yet.
      if (voices.length > 0 && !voice) { onEnd(); return; }
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

  // ── TTS: try ElevenLabs first, fall back to Web Speech ────────────────
  const speak = useCallback(async (text: string, speechToken: string | null, afterSpeak?: () => void) => {
    mute();
    recognitionRef.current?.abort();
    recognitionRef.current   = null;
    finalTextRef.current     = "";
    accumulatedTextRef.current = "";
    setAgentState("speaking");
    agentStateRef.current = "speaking";

    const cleaned = toSpeakable(text);
    lastAgentTextRef.current = cleaned; // track for echo detection in interrupt listener

    const onEnd = () => {
      stopInterruptListener();
      setSpeakingTurnId("");
      if (!isActiveRef.current) return;
      if (afterSpeak) {
        afterSpeak();
      } else {
        setAgentState("listening");
        agentStateRef.current    = "listening";
        accumulatedTextRef.current = "";
        setTimeout(() => {
          if (isActiveRef.current && agentStateRef.current === "listening") startListening();
        }, 250);
      }
    };

    try {
      if (!speechToken) throw new Error("no-token"); // an offline message, so the local voice reads it
      const controller = new AbortController();
      const ttsTimeout = setTimeout(() => controller.abort(), 4000);

      const res = await fetch("/api/tts", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ speechToken }),
        signal:  controller.signal,
      });
      clearTimeout(ttsTimeout);

      if (res.status === 501) throw new Error("no-key");
      if (!res.ok) throw new Error(`tts-${res.status}`);

      addToQuota(cleaned.length);

      const MIME = "audio/mpeg";
      if (res.body && typeof MediaSource !== "undefined" && MediaSource.isTypeSupported(MIME)) {
        const ms    = new MediaSource();
        const url   = URL.createObjectURL(ms);
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

        ms.addEventListener("sourceopen", () => {
          const sb = ms.addSourceBuffer(MIME);
          const queue: Uint8Array<ArrayBuffer>[] = [];
          let appending  = false;
          let streamDone = false;

          function flush() {
            if (appending || !queue.length) {
              if (!appending && streamDone) {
                try { ms.endOfStream(); } catch { /* already ended */ }
              }
              return;
            }
            appending = true;
            sb.appendBuffer(queue.shift()!);
          }

          sb.addEventListener("updateend", () => { appending = false; flush(); });

          (async () => {
            const reader = res.body!.getReader();
            try {
              for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                queue.push(new Uint8Array(value) as Uint8Array<ArrayBuffer>);
                flush();
              }
            } finally {
              streamDone = true;
              flush();
            }
          })();
        }, { once: true });

        await audio.play().catch(() => webSpeechFallback(cleaned, onEnd));
        setTimeout(() => {
          if (agentStateRef.current === "speaking" && isActiveRef.current) startInterruptListener();
        }, 500);
      } else {
        // Fallback: buffer full response then play (Safari / no MediaSource)
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
        setTimeout(() => {
          if (agentStateRef.current === "speaking" && isActiveRef.current) startInterruptListener();
        }, 500);
      }
    } catch {
      webSpeechFallback(cleaned, onEnd);
    }
  }, []); // stable — reads state via refs

  // ── STT: listen continuously, accumulate across sessions, debounce send ──
  function startListening() {
    if (!isActiveRef.current) return;
    const w    = window as WindowWithSpeech;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setVoiceError("This browser doesn't support speech recognition. You can type instead, or use Chrome or Edge.");
      return;
    }

    finalTextRef.current = "";
    setInterimText("");

    const rec = new Ctor();
    rec.continuous     = false;
    rec.interimResults = true;
    rec.lang           = "en-US";
    let retryAfterEnd  = true;

    rec.onresult = (event: SREvent) => {
      lastSpeechTimeRef.current = Date.now();
      checkinCountRef.current   = 0;

      let transcript = "";
      for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript;
      setInterimText(transcript);
      if (event.results[event.results.length - 1].isFinal) {
        finalTextRef.current = correctTranscript(transcript.trim());
        setInterimText("");
      }
    };

    rec.onend = () => {
      recognitionRef.current = null;
      const chunk = finalTextRef.current;
      finalTextRef.current = "";

      if (chunk && isActiveRef.current) {
        accumulatedTextRef.current = (accumulatedTextRef.current + " " + chunk).trim();

        if (processingTimerRef.current) clearTimeout(processingTimerRef.current);
        processingTimerRef.current = setTimeout(() => {
          processingTimerRef.current = null;
          const full = accumulatedTextRef.current;
          if (full && isActiveRef.current && agentStateRef.current === "listening") {
            accumulatedTextRef.current = "";
            setInterimText("");
            callAgent(full);
          }
        }, 2500); // wait 2.5s of silence before sending

        // Restart to catch continuation
        setTimeout(() => {
          if (isActiveRef.current && agentStateRef.current === "listening") startListening();
        }, 300);
      } else if (retryAfterEnd && isActiveRef.current && agentStateRef.current === "listening") {
        setTimeout(() => {
          if (isActiveRef.current && agentStateRef.current === "listening") startListening();
        }, 400);
      }
    };

    rec.onerror = (event: Event) => {
      const e = event as Event & { error?: string };
      // Retrying can't fix these, so say what's wrong instead of looping silently
      const permanent: Record<string, string> = {
        "not-allowed":         "Microphone access is blocked. Allow it in your browser settings, or type instead.",
        "service-not-allowed": "Speech recognition is blocked in this browser. You can type instead.",
        "audio-capture":       "No microphone was found. You can type instead.",
        "language-not-supported": "Speech recognition isn't available for this language here. You can type instead.",
      };
      const message = e.error ? permanent[e.error] : undefined;
      if (message) {
        setVoiceError(message);
        clearSilenceWatcher();
        retryAfterEnd = false;
        return;
      }
      if (e.error !== "aborted" && isActiveRef.current && agentStateRef.current === "listening") {
        setTimeout(() => {
          if (isActiveRef.current && agentStateRef.current === "listening") startListening();
        }, 400);
      }
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      armSilenceWatcher();
    } catch {
      setTimeout(() => {
        if (isActiveRef.current && agentStateRef.current === "listening") startListening();
      }, 500);
    }
  }

  // ── Core agent call ────────────────────────────────────────────────────
  const callAgent = useCallback(async (userInput: string, event: "message" | "takeover" | "silence" = "message") => {
    if (!isActiveRef.current) return;

    clearSilenceWatcher();
    if (processingTimerRef.current) { clearTimeout(processingTimerRef.current); processingTimerRef.current = null; }
    accumulatedTextRef.current = "";
    stopInterruptListener();
    recognitionRef.current?.abort();
    recognitionRef.current = null;

    if (userInput) {
      const userTurn: AgentTurn = { id: genId(), role: "user", content: userInput, timestamp: Date.now() };
      turnsRef.current = [...turnsRef.current, userTurn];
      setTurns(turnsRef.current);
      setSentiment(scoreSentiment(userInput));
    }

    setAgentState("thinking");
    agentStateRef.current = "thinking";

    try {
      const res = await fetch(`/api/calls/${callIdRef.current}/turns`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callToken: callTokenRef.current, event, text: userInput || undefined }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as TurnResponse;
      if (!isActiveRef.current) return; // call ended while this reply was in flight

      callTokenRef.current = data.callToken;
      setCallToken(data.callToken);
      if (data.escalationId) setEscalationId(data.escalationId);

      setActiveAgent(data.nextAgent);
      activeAgentRef.current = data.nextAgent;

      const agentTurn: AgentTurn = {
        id: data.turnId, role: "agent", content: data.text,
        agent: data.agent, timestamp: Date.now(),
      };
      turnsRef.current = [...turnsRef.current, agentTurn];
      setTurns(turnsRef.current);

      setSpeakingTurnId(agentTurn.id);
      if (data.handoff) {
        speak(data.text, data.speechToken, () => {
          if (isActiveRef.current) callAgent("", "takeover");
        });
      } else {
        speak(data.text, data.speechToken);
      }
    } catch (err) {
      console.error("Agent call failed:", err);
      if (event !== "message") {
        // A check-in or takeover that failed has nothing to say, so go back to listening
        setAgentState("listening");
        agentStateRef.current = "listening";
        startListening();
        return;
      }
      // The API is unreachable here, so these checks have to run in the browser
      const message = isEmergencyStatement(userInput)
        ? EMERGENCY_MESSAGE
        : "Sorry, I didn't catch that — could you say that again?";
      // Saved as a turn so the words are on screen even if audio fails too
      const fallbackTurn: AgentTurn = {
        id: genId(), role: "agent", content: message,
        agent: activeAgentRef.current, timestamp: Date.now(),
      };
      turnsRef.current = [...turnsRef.current, fallbackTurn];
      setTurns(turnsRef.current);
      speak(message, null);
    }
  }, [speak]);

  // ── Call lifecycle ─────────────────────────────────────────────────────
  const startCall = useCallback(async () => {
    setTurns([]);                    turnsRef.current       = [];
    setActiveAgent("orchestrator");  activeAgentRef.current = "orchestrator";
    setBrief(null);                  setBriefError("");
    setElapsed(0);                   finalTextRef.current   = "";
    setVoiceError("");
    setEscalationId(null);
    setSentiment("neutral");
    setSpeakingTurnId("");
    accumulatedTextRef.current = "";
    if (processingTimerRef.current) { clearTimeout(processingTimerRef.current); processingTimerRef.current = null; }

    checkinCountRef.current   = 0;
    lastSpeechTimeRef.current = Date.now();

    let started: { callId: string; callToken: string; turnId: string; text: string; speechToken: string };
    try {
      const res = await fetch("/api/calls", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      started = await res.json();
    } catch (err) {
      console.error("Call failed to start:", err);
      setVoiceError("The call couldn't start. Please try again.");
      return;
    }

    callIdRef.current    = started.callId;
    callTokenRef.current = started.callToken;
    setCallToken(started.callToken);
    isActiveRef.current  = true;
    setStatus("active");

    startTimeRef.current = Date.now();
    timerRef.current = setInterval(
      () => setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000)),
      1000
    );

    const greeting: AgentTurn = {
      id: started.turnId, role: "agent", content: started.text, agent: "orchestrator", timestamp: Date.now(),
    };
    turnsRef.current = [greeting];
    setTurns(turnsRef.current);
    setSpeakingTurnId(greeting.id);
    speak(started.text, started.speechToken);
  }, [speak]);

  const endCall = useCallback(async () => {
    isActiveRef.current   = false;
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

    try {
      const res = await fetch(`/api/calls/${callIdRef.current}/end`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ callToken: callTokenRef.current }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { brief: CallBriefData };
      setBrief({ ...data.brief, duration });
    } catch (err) {
      console.error("Brief failed:", err);
      setBriefError("The call ended, but a brief couldn't be generated.");
    }

    setStatus("done");
  }, []);

  const handleTransfer = useCallback(async () => {
    setTransferring(true);
    // Before mute(): cancelling speech fires its end callback, which would otherwise
    // resume listening and let the silence check-in cut this message off.
    isActiveRef.current = false;
    clearSilenceWatcher();
    mute();
    stopInterruptListener();
    setAgentState("speaking");
    agentStateRef.current = "speaking";
    recognitionRef.current?.abort();
    let message = NO_LIVE_STAFF_MESSAGE;
    let turnId = genId();
    try {
      // Records the request. If it fails, the caller still gets the honest message.
      const res = await fetch(`/api/calls/${callIdRef.current}/turns`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ callToken: callTokenRef.current, event: "human_request" }),
      });
      if (res.ok) {
        const data = (await res.json()) as TurnResponse;
        callTokenRef.current = data.callToken;
        setCallToken(data.callToken);
        if (data.escalationId) setEscalationId(data.escalationId);
        turnId  = data.turnId;
        message = data.text;
      }
    } catch { /* fall through with the local message */ }

    const noStaffTurn: AgentTurn = {
      id: turnId, role: "agent", content: message,
      agent: activeAgentRef.current, timestamp: Date.now(),
    };
    turnsRef.current = [...turnsRef.current, noStaffTurn];
    setTurns(turnsRef.current);
    // Always the local voice, so the call can end as soon as it finishes
    webSpeechFallback(message, () => endCall());
  }, [endCall]);

  const handleNewCall = useCallback(() => {
    setStatus("idle");  setBrief(null);   setBriefError("");
    setTurns([]);       setElapsed(0);    setActiveAgent("orchestrator");
    setAgentState("idle");
    setTransferring(false);
    setVoiceError("");
    setEscalationId(null);
    setSentiment("neutral");
    setSpeakingTurnId("");
  }, []);

  // Cleanup on unmount
  useEffect(() => () => {
    isActiveRef.current = false;
    mute();
    clearSilenceWatcher();
    recognitionRef.current?.abort();
    interruptRecRef.current?.abort();
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const agentMeta = AGENT_META[activeAgent];
  const isEnding  = status === "ending";

  return (
    <div className="flex flex-col h-full relative">
      <DemoNotice />

      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="glass-panel border-b border-white/20 px-6 py-3 shrink-0">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 transition-all ${agentMeta.dot}`}>
            {activeAgent[0].toUpperCase()}
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-800 leading-tight">Oxygen Support Demo</h1>
            <p className="text-[11px] text-gray-400">AI call agent, not affiliated with Inogen</p>
          </div>

          {status === "active" && (
            <AgentBadge agent={activeAgent} state={agentState} />
          )}

          <div className="ml-auto flex items-center gap-4">
            {status === "active" && (
              <div className={`flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                sentiment === "positive" ? "bg-emerald-100 text-emerald-700"
                : sentiment === "negative" ? "bg-red-100 text-red-600"
                : "bg-gray-100 text-gray-500"
              }`}>
                <span>●</span>
                <span>{sentiment === "positive" ? "Positive" : sentiment === "negative" ? "Negative" : "Neutral"}</span>
              </div>
            )}
            {quotaUsed >= EL_QUOTA_WARN && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                quotaUsed >= EL_QUOTA_LIMIT
                  ? "bg-red-100 text-red-600"
                  : "bg-amber-100 text-amber-700"
              }`}>
                {quotaUsed >= EL_QUOTA_LIMIT
                  ? "Voice quota full"
                  : `Voice ${Math.round(quotaUsed / 100) / 10}k / 10k chars`}
              </span>
            )}
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
                  onClick={handleTransfer}
                  disabled={transferring}
                  className="text-xs px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-all disabled:opacity-50"
                >
                  Ask for a person
                </button>
                <button
                  onClick={endCall}
                  disabled={transferring}
                  className="text-xs px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-all disabled:opacity-50"
                >
                  End Call
                </button>
              </>
            )}
            <a
              href="/dashboard"
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Dashboard
            </a>
            {status === "ending" && <span className="text-xs text-gray-400">Generating brief…</span>}
            {status === "done" && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-xs text-emerald-600 font-medium">Brief ready</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Body ──────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden max-w-6xl w-full mx-auto">

        {/* Left — Sphere */}
        <div className="w-2/5 min-h-0 overflow-y-auto flex flex-col items-center justify-center-safe gap-5 p-8 border-r border-white/20">
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

          {(status === "active" || status === "idle") && voiceError && (
            <p role="alert" className="text-xs text-red-600 text-center max-w-xs">{voiceError}</p>
          )}
          {status === "active" && (
            <TypedInput disabled={agentState === "thinking" || transferring} onSend={(text) => callAgent(text)} />
          )}
        </div>

        {/* Right — Transcript / Brief */}
        <div className="w-3/5 flex flex-col overflow-hidden">
          {status === "done" && brief ? (
            <>
              {escalationId && <CallbackForm callId={callIdRef.current} callToken={callToken} />}
              <CallBrief brief={brief} onNewCall={handleNewCall} />
            </>
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
              speakingTurnId={speakingTurnId}
            />
          )}
        </div>
      </div>
    </div>
  );
}
