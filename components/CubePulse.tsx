"use client";

import { useEffect, useRef } from "react";

interface Props {
  isActive: boolean;
  volume: number; // 0–1, updated at ~60fps by the parent
}

export default function CubePulse({ isActive, volume }: Props) {
  const cubeRef = useRef<HTMLDivElement>(null);
  const rotYRef = useRef(0);
  const rafRef = useRef<number>(0);

  // Refs so the RAF loop always reads current props without being restarted
  const isActiveRef = useRef(isActive);
  const volumeRef = useRef(volume);
  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);

  // Single long-lived animation loop — runs for component lifetime
  useEffect(() => {
    let running = true;

    function animate() {
      if (!running || !cubeRef.current) return;

      const vol = volumeRef.current;
      const active = isActiveRef.current;

      // Rotate faster when active and loud
      rotYRef.current += active ? 0.4 + vol * 0.6 : 0.25;

      // Scale up with volume; idle at 1
      const scale = active ? 1 + vol * 0.5 : 1;

      cubeRef.current.style.transform =
        `rotateX(-18deg) rotateY(${rotYRef.current}deg) scale(${scale})`;

      // Glow brightens and spreads with volume
      const glowRadius = active ? 8 + vol * 32 : 6;
      const glowAlpha  = active ? 0.25 + vol * 0.55 : 0.12;
      cubeRef.current.style.filter =
        `brightness(${1 + (active ? vol * 0.6 : 0)}) ` +
        `drop-shadow(0 0 ${glowRadius}px rgba(20,184,166,${glowAlpha.toFixed(2)}))`;

      rafRef.current = requestAnimationFrame(animate);
    }

    animate();
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, []); // intentionally empty — reads from refs

  return (
    <div className="cube-scene">
      <div ref={cubeRef} className="cube">
        <div className="cube-face cube-face--front" />
        <div className="cube-face cube-face--back" />
        <div className="cube-face cube-face--left" />
        <div className="cube-face cube-face--right" />
        <div className="cube-face cube-face--top" />
        <div className="cube-face cube-face--bottom" />
      </div>
    </div>
  );
}
