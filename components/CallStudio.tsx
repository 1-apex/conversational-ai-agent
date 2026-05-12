"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { CallStatus, TranscriptTurn, EntityMap, CallBriefData } from "@/lib/types";
import { extractEntities, mergeEntities, EMPTY_ENTITY_MAP } from "@/lib/entity-extractor";
import CubePulse from "./CubePulse";
import TranscriptPanel from "./TranscriptPanel";
import CallBrief from "./CallBrief";

// ── SpeechRecognition local types (absent from some TS DOM lib versions) ──
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

export default function CallStudio() {
  const [status, setStatus]               = useState<CallStatus>("idle");
  const [turns, setTurns]                 = useState<TranscriptTurn[]>([]);
  const [interimText, setInterimText]     = useState("");
  const [currentSpeaker, setCurrentSpeaker] = useState<"agent" | "prospect">("agent");
  const [allEntities, setAllEntities]     = useState<EntityMap>(EMPTY_ENTITY_MAP);
  const [volume, setVolume]               = useState(0);
  const [elapsed, setElapsed]             = useState(0);
  const [brief, setBrief]                 = useState<CallBriefData | null>(null);
  const [briefError, setBriefError]       = useState("");

  // Stable refs for values read inside callbacks
  const currentSpeakerRef = useRef<"agent" | "prospect">("agent");
  const isActiveRef        = useRef(false);
  const lastFinalIdxRef    = useRef(-1);

  // Infrastructure refs
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const audioCtxRef    = useRef<AudioContext | null>(null);
  const analyserRef    = useRef<AnalyserNode | null>(null);
  const streamRef      = useRef<MediaStream | null>(null);
  const audioRafRef    = useRef<number>(0);
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef   = useRef(0);

  useEffect(() => { currentSpeakerRef.current = currentSpeaker; }, [currentSpeaker]);

  // ── Audio volume analyser ────────────────────────────────────────────────
  const startAudio = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setVolume(Math.min(avg / 80, 1));
        audioRafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* mic denied — cube just stays at rest */ }
  }, []);

  const stopAudio = useCallback(() => {
    cancelAnimationFrame(audioRafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
    setVolume(0);
  }, []);

  // ── SpeechRecognition ────────────────────────────────────────────────────
  const startRecognition = useCallback(() => {
    const w = window as WindowWithSpeech;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (event: SREvent) => {
      // Process any newly-finalized results
      for (let i = lastFinalIdxRef.current + 1; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const text = event.results[i][0].transcript.trim();
          if (text) {
            const entities = extractEntities(text);
            const turn: TranscriptTurn = {
              id: genId(),
              speaker: currentSpeakerRef.current,
              text,
              timestamp: Date.now(),
              entities,
            };
            setTurns((prev) => [...prev, turn]);
            setAllEntities((prev) => mergeEntities(prev, entities));
          }
          lastFinalIdxRef.current = i;
          setInterimText("");
        }
      }
      // Show current interim (last result if not final)
      const last = event.results[event.results.length - 1];
      if (!last.isFinal) setInterimText(last[0].transcript);
    };

    // Chrome stops continuous recognition silently — restart while active
    rec.onend = () => {
      if (isActiveRef.current) {
        try { rec.start(); } catch { /* already running */ }
      }
    };

    rec.onerror = (event: Event) => {
      const e = event as Event & { error?: string };
      if (e.error === "no-speech" && isActiveRef.current) {
        try { rec.start(); } catch { /* */ }
      }
    };

    recognitionRef.current = rec;
    try { rec.start(); } catch { /* */ }
  }, []);

  const stopRecognition = useCallback(() => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setInterimText("");
  }, []);

  // ── Call lifecycle ────────────────────────────────────────────────────────
  const startCall = useCallback(async () => {
    setTurns([]);
    setAllEntities(EMPTY_ENTITY_MAP);
    setInterimText("");
    setBrief(null);
    setBriefError("");
    setElapsed(0);
    setCurrentSpeaker("agent");
    lastFinalIdxRef.current = -1;
    isActiveRef.current = true;
    setStatus("active");

    startTimeRef.current = Date.now();
    timerRef.current = setInterval(
      () => setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000)),
      1000
    );

    await startAudio();
    startRecognition();
  }, [startAudio, startRecognition]);

  const endCall = useCallback(async () => {
    isActiveRef.current = false;
    setStatus("ending");

    // Freeze timer
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);

    stopRecognition();
    stopAudio();

    // Snapshot turns synchronously; state update is async
    setTurns((prev) => {
      void (async () => {
        try {
          const res = await fetch("/api/extract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ turns: prev, duration }),
          });
          if (!res.ok) throw new Error(await res.text());
          const data = (await res.json()) as CallBriefData;
          setBrief(data);
          setStatus("done");
        } catch (err) {
          setBriefError(err instanceof Error ? err.message : "Extraction failed");
          setStatus("done");
        }
      })();
      return prev;
    });
  }, [stopAudio, stopRecognition]);

  const handleNewCall = useCallback(() => {
    setBrief(null);
    setBriefError("");
    setTurns([]);
    setAllEntities(EMPTY_ENTITY_MAP);
    setElapsed(0);
    setStatus("idle");
  }, []);

  // Cleanup on unmount
  useEffect(() => () => {
    isActiveRef.current = false;
    stopRecognition();
    stopAudio();
    if (timerRef.current) clearInterval(timerRef.current);
  }, [stopAudio, stopRecognition]);

  const isEnding = status === "ending";

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="glass-panel border-b border-white/20 px-6 py-3.5 shrink-0">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
            C
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-800 leading-tight">CareLink</h1>
            <p className="text-[11px] text-gray-400">Call Intelligence</p>
          </div>

          <div className="ml-auto flex items-center gap-4">
            {/* Timer */}
            {(status === "active" || status === "ending" || status === "done") && (
              <span className="font-mono text-sm text-gray-600 tabular-nums">
                {fmtTime(elapsed)}
              </span>
            )}

            {/* Status badge */}
            {status === "active" && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs text-red-600 font-medium">Recording</span>
              </div>
            )}
            {status === "ending" && (
              <span className="text-xs text-gray-400">Generating brief…</span>
            )}
            {status === "done" && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-xs text-emerald-600 font-medium">Brief ready</span>
              </div>
            )}

            {/* End call button */}
            {status === "active" && (
              <button
                onClick={endCall}
                className="text-xs px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-all"
              >
                End Call
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden max-w-6xl w-full mx-auto">

        {/* Left — Cube */}
        <div className="w-2/5 flex flex-col items-center justify-center gap-6 p-8 border-r border-white/20">
          <CubePulse isActive={status === "active"} volume={volume} />

          {/* Status text under cube */}
          <div className="text-center space-y-1">
            {status === "idle" && (
              <p className="text-sm text-gray-500">Ready to record</p>
            )}
            {status === "active" && (
              <p className="text-sm text-teal-600 font-medium animate-pulse">Listening…</p>
            )}
            {status === "ending" && (
              <p className="text-sm text-gray-400">Processing call…</p>
            )}
            {status === "done" && (
              <p className="text-sm text-gray-500">Call ended</p>
            )}

            {/* Start call button (idle only) */}
            {status === "idle" && (
              <button
                onClick={startCall}
                className="mt-4 px-8 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-xl font-medium text-sm hover:from-teal-600 hover:to-cyan-600 transition-all shadow-lg shadow-teal-500/25 active:scale-95"
              >
                Start Call
              </button>
            )}
          </div>
        </div>

        {/* Right — Transcript / Brief */}
        <div className="w-3/5 flex flex-col overflow-hidden">
          {status === "done" && brief ? (
            <CallBrief brief={brief} onNewCall={handleNewCall} />
          ) : status === "done" && briefError ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
              <p className="text-sm text-red-500">{briefError}</p>
              <button onClick={handleNewCall} className="text-xs text-teal-600 underline">
                Start a new call
              </button>
            </div>
          ) : isEnding ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3">
                <div className="waveform"><span /><span /><span /><span /></div>
                <p className="text-sm text-gray-500">Analyzing transcript with Claude…</p>
              </div>
            </div>
          ) : (
            <TranscriptPanel
              turns={turns}
              interimText={interimText}
              currentSpeaker={currentSpeaker}
              allEntities={allEntities}
            />
          )}
        </div>
      </div>

      {/* ── Footer — Speaker toggle (active only) ───────────────────────────── */}
      {status === "active" && (
        <footer className="glass-panel border-t border-white/20 px-6 py-3 shrink-0">
          <div className="max-w-6xl mx-auto flex items-center justify-center gap-3">
            <p className="text-xs text-gray-400 mr-2">Speaking as:</p>

            <button
              onClick={() => setCurrentSpeaker("agent")}
              aria-pressed={currentSpeaker === "agent"}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                currentSpeaker === "agent"
                  ? "bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-md shadow-teal-500/25"
                  : "glass-panel text-gray-500 border border-white/30 hover:border-teal-400/40"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${currentSpeaker === "agent" ? "bg-white" : "bg-teal-400"}`} />
              Agent
            </button>

            <button
              onClick={() => setCurrentSpeaker("prospect")}
              aria-pressed={currentSpeaker === "prospect"}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                currentSpeaker === "prospect"
                  ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md shadow-violet-500/25"
                  : "glass-panel text-gray-500 border border-white/30 hover:border-violet-400/40"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${currentSpeaker === "prospect" ? "bg-white" : "bg-violet-400"}`} />
              Prospect
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
