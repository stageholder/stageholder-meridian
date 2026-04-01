"use client";

import { useMemo } from "react";

const RADIANCE_COLORS = [
  "oklch(0.88 0.20 75)", // warm amber
  "oklch(0.82 0.22 65)", // deep gold
  "oklch(0.92 0.14 85)", // bright yellow
  "oklch(0.78 0.18 50)", // rich amber
  "oklch(0.95 0.08 90)", // soft cream
  "oklch(0.85 0.16 95)", // golden light
];

interface Ray {
  id: number;
  angle: number;
  length: number;
  width: number;
  delay: number;
  duration: number;
  color: string;
}

interface Spark {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
}

interface RadianceBurstProps {
  active: boolean;
  /** Habit's own color — mixed into the effect */
  color?: string;
}

/**
 * Sunburst radiance effect for habit completion.
 * Warm light rays expand outward from center + golden sparkle particles
 * drift gently upward. Feels nurturing and rewarding, not destructive.
 */
export function RadianceBurst({ active, color }: RadianceBurstProps) {
  const rays = useMemo(() => {
    return Array.from({ length: 10 }, (_, i): Ray => {
      const baseAngle = (360 / 10) * i + (Math.random() - 0.5) * 18;
      return {
        id: i,
        angle: baseAngle,
        length: 50 + Math.random() * 40,
        width: 2 + Math.random() * 2,
        delay: Math.random() * 150,
        duration: 500 + Math.random() * 300,
        color:
          RADIANCE_COLORS[Math.floor(Math.random() * RADIANCE_COLORS.length)]!,
      };
    });
  }, []);

  const sparks = useMemo(() => {
    return Array.from({ length: 14 }, (_, i): Spark => {
      const angle = Math.random() * 360;
      const rad = (angle * Math.PI) / 180;
      const dist = 30 + Math.random() * 60;
      return {
        id: i + 50,
        x: 50 + Math.cos(rad) * 8,
        y: 50 + Math.sin(rad) * 8,
        dx: Math.cos(rad) * dist,
        dy: Math.sin(rad) * dist - 15, // slight upward bias
        size: 2.5 + Math.random() * 3.5,
        color:
          RADIANCE_COLORS[Math.floor(Math.random() * RADIANCE_COLORS.length)]!,
        delay: 50 + Math.random() * 250,
        duration: 600 + Math.random() * 400,
      };
    });
  }, []);

  if (!active) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10"
      aria-hidden="true"
      style={{ overflow: "visible" }}
    >
      {/* Center glow pulse */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full habit-center-glow"
        style={{
          width: 80,
          height: 80,
          background: `radial-gradient(circle, ${color || "oklch(0.82 0.22 65)"}40 0%, transparent 70%)`,
        }}
      />

      {/* Light rays emanating from center */}
      {rays.map((r) => (
        <span
          key={r.id}
          className="absolute left-1/2 top-1/2 origin-bottom habit-ray"
          style={{
            width: r.width,
            height: 0,
            backgroundColor: r.color,
            boxShadow: `0 0 ${r.width + 3}px ${r.color}`,
            borderRadius: r.width,
            transform: `translate(-50%, -100%) rotate(${r.angle}deg)`,
            ["--ray-length" as string]: `${r.length}px`,
            animationDelay: `${r.delay}ms`,
            animationDuration: `${r.duration}ms`,
          }}
        />
      ))}

      {/* Sparkle particles */}
      {sparks.map((s) => (
        <span
          key={s.id}
          className="absolute rounded-full habit-spark"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            backgroundColor: s.color,
            boxShadow: `0 0 ${s.size + 4}px ${s.color}`,
            ["--spark-dx" as string]: `${s.dx}px`,
            ["--spark-dy" as string]: `${s.dy}px`,
            animationDelay: `${s.delay}ms`,
            animationDuration: `${s.duration}ms`,
          }}
        />
      ))}
    </div>
  );
}
