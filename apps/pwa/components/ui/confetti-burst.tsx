"use client";

import { useEffect, useState } from "react";

interface Particle {
  id: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  size: number;
  color: string;
  delay: number;
}

interface ConfettiBurstProps {
  /** Number of particles */
  count?: number;
  /** Colors to randomly pick from */
  colors?: string[];
  /** How far particles travel in px */
  spread?: number;
  /** Duration in ms */
  duration?: number;
  /** Trigger key — change this to re-fire */
  trigger: number;
  /** Size of the burst origin area */
  originWidth?: string;
}

export function ConfettiBurst({
  count = 12,
  colors = [
    "oklch(0.83 0.19 85)", // journal gold
    "oklch(0.75 0.22 55)", // habit amber
    "oklch(0.65 0.29 25)", // todo coral
    "oklch(0.90 0.12 90)", // soft yellow
    "oklch(0.70 0.15 140)", // green
  ],
  spread = 60,
  duration = 700,
  trigger,
  originWidth = "100%",
}: ConfettiBurstProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (trigger === 0) return;

    const newParticles: Particle[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100, // % across the origin
      y: 0,
      angle: -90 + (Math.random() - 0.5) * 120, // upward spread
      speed: spread * (0.5 + Math.random() * 0.5),
      size: 3 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)]!,
      delay: Math.random() * 150,
    }));

    setParticles(newParticles);

    const timer = setTimeout(() => setParticles([]), duration + 200);
    return () => clearTimeout(timer);
  }, [trigger]); // eslint-disable-line react-hooks/exhaustive-deps

  if (particles.length === 0) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-visible"
      style={{ width: originWidth }}
      aria-hidden="true"
    >
      {particles.map((p) => {
        const rad = (p.angle * Math.PI) / 180;
        const tx = Math.cos(rad) * p.speed;
        const ty = Math.sin(rad) * p.speed;

        return (
          <span
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: `${p.x}%`,
              bottom: "50%",
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              animationName: "confetti-fly",
              animationDuration: `${duration}ms`,
              animationDelay: `${p.delay}ms`,
              animationTimingFunction: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
              animationFillMode: "forwards",
              ["--confetti-tx" as string]: `${tx}px`,
              ["--confetti-ty" as string]: `${ty}px`,
              opacity: 0,
            }}
          />
        );
      })}
    </div>
  );
}
