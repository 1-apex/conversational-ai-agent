"use client";

import { useEffect, useRef } from "react";
import { AgentState } from "@/lib/types";

interface Props {
  agentState: AgentState;
}

const W  = 280;
const H  = 280;
const CX = W / 2;
const CY = H / 2;

const CORE_R     = 42;
const BAR_START  = 58;
const BAR_MAX    = 52;
const RING_MID_R = 116;
const RING_OUT_R = 132;
const HUD_R      = 148;
const NUM_BARS   = 128;

export default function CubePulse({ agentState }: Props) {
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const ctxRef         = useRef<CanvasRenderingContext2D | null>(null);
  const rafRef         = useRef<number>(0);
  const rotRef         = useRef(0);
  const agentStateRef  = useRef<AgentState>(agentState);

  const freqRef    = useRef<Uint8Array<ArrayBuffer>>(new Uint8Array(NUM_BARS) as Uint8Array<ArrayBuffer>);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);

  useEffect(() => { agentStateRef.current = agentState; }, [agentState]);

  // Open mic when call is active, close on idle
  useEffect(() => {
    const active = agentState !== "idle";
    if (!active) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
      analyserRef.current = null;
      freqRef.current = new Uint8Array(NUM_BARS) as Uint8Array<ArrayBuffer>;
      return;
    }

    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ audio: true, video: false })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const actx = new AudioContext();
        audioCtxRef.current = actx;
        const analyser = actx.createAnalyser();
        analyser.fftSize = NUM_BARS * 2;
        analyserRef.current = analyser;
        freqRef.current = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
        actx.createMediaStreamSource(stream).connect(analyser);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [agentState]);

  // Long-lived draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctxRef.current = canvas.getContext("2d");
    ctxRef.current?.scale(dpr, dpr);

    let running = true;

    function draw() {
      if (!running) return;
      const ctx = ctxRef.current;
      if (!ctx) { rafRef.current = requestAnimationFrame(draw); return; }

      const state = agentStateRef.current;
      const t     = Date.now();

      if (analyserRef.current) analyserRef.current.getByteFrequencyData(freqRef.current);
      const freq   = freqRef.current;
      const micVol = freq.reduce((s, v) => s + v, 0) / freq.length / 255;

      // Rotation speed depends on state
      rotRef.current += state === "speaking" ? 0.5 + micVol * 0.8
                      : state === "listening" ? 0.45 + micVol * 1.2
                      : state === "thinking"  ? 0.12
                      : 0.18; // idle
      const rot = (rotRef.current * Math.PI) / 180;

      ctx.clearRect(0, 0, W, H);

      // ── Frequency bars ─────────────────────────────────────────────────
      for (let i = 0; i < NUM_BARS; i++) {
        const angle = (i / NUM_BARS) * Math.PI * 2 - Math.PI / 2;
        const phase = (i / NUM_BARS) * Math.PI * 6;

        let barH: number;
        let alpha: number;

        if (state === "listening" && analyserRef.current) {
          // Real mic data
          barH  = Math.max(1, (freq[i] / 255) * BAR_MAX);
          alpha = 0.3 + (freq[i] / 255) * 0.7;
        } else if (state === "speaking") {
          // Synthetic pulse so sphere looks alive when agent speaks
          const synthA = Math.abs(Math.sin(t * 0.004 + phase * 1.5)) * 0.7 + 0.3;
          const synthB = Math.abs(Math.sin(t * 0.003 + i * 0.15))    * 0.5 + 0.5;
          barH  = 4 + synthA * synthB * 28;
          alpha = 0.35 + synthA * 0.45;
        } else if (state === "thinking") {
          // Very dim slow pulse
          barH  = (Math.sin(t * 0.0005 + phase) * 0.5 + 0.5) * 4 + 1;
          alpha = 0.1 + (Math.sin(t * 0.001 + phase) * 0.5 + 0.5) * 0.08;
        } else {
          // Idle gentle shimmer
          barH  = (Math.sin(t * 0.0008 + phase) * 0.5 + 0.5) * 7 + 1;
          alpha = 0.16;
        }

        const hue = state === "speaking" ? 195 + Math.sin(t * 0.002 + phase) * 15
                  : state === "thinking" ? 210 : 178;

        ctx.strokeStyle = `hsla(${hue},78%,58%,${alpha.toFixed(2)})`;
        ctx.lineWidth   = state === "idle" || state === "thinking" ? 1 : 1.5;
        ctx.beginPath();
        ctx.moveTo(CX + Math.cos(angle) * BAR_START,          CY + Math.sin(angle) * BAR_START);
        ctx.lineTo(CX + Math.cos(angle) * (BAR_START + barH), CY + Math.sin(angle) * (BAR_START + barH));
        ctx.stroke();
      }

      // ── Dashed rotating ring ─────────────────────────────────────────────
      const ringAlpha = state === "thinking" ? 0.07 : state === "idle" ? 0.08 : 0.28 + micVol * 0.25;
      ctx.save();
      ctx.translate(CX, CY);
      ctx.rotate(rot);
      ctx.strokeStyle = `rgba(20,184,166,${ringAlpha})`;
      ctx.lineWidth   = 1;
      ctx.setLineDash([6, 14]);
      ctx.beginPath();
      ctx.arc(0, 0, RING_MID_R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // ── Outer ring ────────────────────────────────────────────────────────
      const outerAlpha = state === "idle" || state === "thinking" ? 0.06 : 0.15 + micVol * 0.18;
      ctx.strokeStyle = `rgba(20,184,166,${outerAlpha})`;
      ctx.lineWidth   = 0.75;
      ctx.beginPath();
      ctx.arc(CX, CY, RING_OUT_R, 0, Math.PI * 2);
      ctx.stroke();

      // ── Core sphere ───────────────────────────────────────────────────────
      const coreVol   = state === "speaking" ? 0.4 + Math.sin(t * 0.004) * 0.2
                      : state === "listening" ? micVol
                      : state === "thinking"  ? 0.12
                      : 0.15;
      const coreAlpha = 0.28 + coreVol * 0.55;
      const coreScale = 1 + coreVol * 0.08;

      const grad = ctx.createRadialGradient(CX - 10, CY - 10, 2, CX, CY, CORE_R * coreScale);
      grad.addColorStop(0,   `rgba(167,243,208,${coreAlpha})`);
      grad.addColorStop(0.4, `rgba(20,184,166,${(coreAlpha * 0.85).toFixed(2)})`);
      grad.addColorStop(0.8, `rgba(6,182,212,${(coreAlpha * 0.45).toFixed(2)})`);
      grad.addColorStop(1,   "rgba(8,145,178,0.04)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(CX, CY, CORE_R * coreScale, 0, Math.PI * 2);
      ctx.fill();

      // ── Core edge ring ────────────────────────────────────────────────────
      ctx.strokeStyle = `rgba(94,234,212,${state === "idle" ? 0.18 : 0.45 + coreVol * 0.4})`;
      ctx.lineWidth   = state === "idle" ? 1 : 1.5 + coreVol * 0.8;
      ctx.beginPath();
      ctx.arc(CX, CY, CORE_R * coreScale + 7, 0, Math.PI * 2);
      ctx.stroke();

      // ── HUD arc accents ───────────────────────────────────────────────────
      const arcAlpha = state === "idle" ? 0.1 : state === "thinking" ? 0.12 : 0.45 + coreVol * 0.3;
      ctx.strokeStyle = `rgba(20,184,166,${arcAlpha})`;
      ctx.lineWidth   = 1.5;
      for (let k = 0; k < 4; k++) {
        const base = (k / 4) * Math.PI * 2 - rot * 0.35;
        ctx.beginPath();
        ctx.arc(CX, CY, HUD_R, base - 0.22, base + 0.22);
        ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => { running = false; cancelAnimationFrame(rafRef.current); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{ width: W, height: H }}
      className="select-none"
    />
  );
}
