"use client";

import { useEffect, useRef } from "react";

interface Props {
  isActive: boolean;
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

export default function CubePulse({ isActive }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  // Store the 2D context in a ref so the draw closure can always do a
  // local `const ctx = ctxRef.current; if (!ctx) return;` — TypeScript
  // can narrow a local variable inside a closure but not a captured one.
  const ctxRef      = useRef<CanvasRenderingContext2D | null>(null);
  const rafRef      = useRef<number>(0);
  const rotRef      = useRef(0);
  const isActiveRef = useRef(isActive);

  // Explicitly typed as ArrayBuffer variant so getByteFrequencyData accepts it
  const freqRef = useRef<Uint8Array<ArrayBuffer>>(new Uint8Array(NUM_BARS) as Uint8Array<ArrayBuffer>);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);

  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);

  // ── Mic setup / teardown when isActive changes ───────────────────────────
  useEffect(() => {
    if (!isActive) {
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
      .catch(() => { /* mic denied — sphere animates without audio data */ });

    return () => { cancelled = true; };
  }, [isActive]);

  // ── Canvas setup + long-lived draw loop ──────────────────────────────────
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

      // Local narrowing — TypeScript can track this inside the closure
      const ctx = ctxRef.current;
      if (!ctx) { rafRef.current = requestAnimationFrame(draw); return; }

      const active = isActiveRef.current;
      const t = Date.now();

      if (analyserRef.current) {
        analyserRef.current.getByteFrequencyData(freqRef.current);
      }

      const freq   = freqRef.current;
      const avgVol = freq.reduce((s, v) => s + v, 0) / freq.length / 255;

      rotRef.current += active ? 0.45 + avgVol * 1.4 : 0.18;
      const rot = (rotRef.current * Math.PI) / 180;

      ctx.clearRect(0, 0, W, H);

      // ── 1. Frequency bars ────────────────────────────────────────────────
      for (let i = 0; i < NUM_BARS; i++) {
        const angle = (i / NUM_BARS) * Math.PI * 2 - Math.PI / 2;

        let barH: number;
        if (active && analyserRef.current) {
          barH = Math.max(1, (freq[i] / 255) * BAR_MAX);
        } else {
          const phase = (i / NUM_BARS) * Math.PI * 6;
          barH = (Math.sin(t * 0.0008 + phase) * 0.5 + 0.5) * 7 + 1;
        }

        const intensity = active ? freq[i] / 255 : 0.12;
        const hue       = 178 + intensity * 22;
        const alpha     = active ? 0.3 + intensity * 0.7 : 0.18;

        ctx.strokeStyle = `hsla(${hue},80%,58%,${alpha.toFixed(2)})`;
        ctx.lineWidth   = active ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(CX + Math.cos(angle) * BAR_START,          CY + Math.sin(angle) * BAR_START);
        ctx.lineTo(CX + Math.cos(angle) * (BAR_START + barH), CY + Math.sin(angle) * (BAR_START + barH));
        ctx.stroke();
      }

      // ── 2. Dashed rotating ring ──────────────────────────────────────────
      ctx.save();
      ctx.translate(CX, CY);
      ctx.rotate(rot);
      ctx.strokeStyle = `rgba(20,184,166,${active ? 0.3 + avgVol * 0.35 : 0.1})`;
      ctx.lineWidth   = 1;
      ctx.setLineDash([6, 14]);
      ctx.beginPath();
      ctx.arc(0, 0, RING_MID_R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // ── 3. Outer boundary ring ───────────────────────────────────────────
      ctx.strokeStyle = `rgba(20,184,166,${active ? 0.18 + avgVol * 0.22 : 0.07})`;
      ctx.lineWidth   = 0.75;
      ctx.beginPath();
      ctx.arc(CX, CY, RING_OUT_R * (1 + (active ? avgVol * 0.06 : 0)), 0, Math.PI * 2);
      ctx.stroke();

      // ── 4. Core sphere ───────────────────────────────────────────────────
      const coreScale = 1 + (active ? avgVol * 0.09 : 0);
      const coreAlpha = active ? 0.55 + avgVol * 0.45 : 0.28;
      const grad = ctx.createRadialGradient(CX - 10, CY - 10, 2, CX, CY, CORE_R * coreScale);
      grad.addColorStop(0,   `rgba(167,243,208,${coreAlpha})`);
      grad.addColorStop(0.4, `rgba(20,184,166,${(coreAlpha * 0.85).toFixed(2)})`);
      grad.addColorStop(0.8, `rgba(6,182,212,${(coreAlpha * 0.45).toFixed(2)})`);
      grad.addColorStop(1,   `rgba(8,145,178,0.05)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(CX, CY, CORE_R * coreScale, 0, Math.PI * 2);
      ctx.fill();

      // ── 5. Core edge ring ────────────────────────────────────────────────
      ctx.strokeStyle = `rgba(94,234,212,${active ? 0.55 + avgVol * 0.45 : 0.22})`;
      ctx.lineWidth   = active ? 1.5 + avgVol : 1;
      ctx.beginPath();
      ctx.arc(CX, CY, CORE_R * coreScale + 7, 0, Math.PI * 2);
      ctx.stroke();

      // ── 6. HUD arc accents at cardinal points ────────────────────────────
      ctx.strokeStyle = `rgba(20,184,166,${active ? 0.5 + avgVol * 0.4 : 0.15})`;
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
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, []); // reads everything via refs — intentionally no deps

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
