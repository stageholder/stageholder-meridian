"use client";

import { useMemo } from "react";

const EMBER_COLORS = [
  "oklch(0.72 0.22 40)", // bright orange
  "oklch(0.65 0.26 30)", // deep orange-red
  "oklch(0.78 0.18 55)", // amber
  "oklch(0.58 0.24 25)", // burnt red
  "oklch(0.82 0.16 70)", // golden yellow
  "oklch(0.50 0.20 20)", // deep ember
];

interface EmberBurstProps {
  active: boolean;
  count?: number;
}

/**
 * CSS-only fire ember particles that erupt upward from the checkbox.
 * Each ember is a tiny circle with randomized:
 *   - drift direction (slight left/right)
 *   - rise height
 *   - size (2-5px)
 *   - color (fire palette)
 *   - delay (staggered eruption)
 *   - duration (speed variation)
 */
export function EmberBurst({ active, count = 10 }: EmberBurstProps) {
  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const color =
        EMBER_COLORS[Math.floor(Math.random() * EMBER_COLORS.length)]!;
      const size = 2 + Math.random() * 3;
      const driftX = (Math.random() - 0.5) * 30; // px left/right
      const riseY = -(20 + Math.random() * 35); // px upward
      const delay = Math.random() * 180; // ms
      const duration = 400 + Math.random() * 300; // ms
      const startX = (Math.random() - 0.5) * 8; // slight offset from center

      return { id: i, color, size, driftX, riseY, delay, duration, startX };
    });
  }, [count]);

  if (!active) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10"
      aria-hidden="true"
      style={{ overflow: "visible" }}
    >
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute rounded-full ember-particle"
          style={{
            left: `calc(50% + ${p.startX}px)`,
            top: "50%",
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            boxShadow: `0 0 ${p.size + 2}px ${p.color}`,
            ["--ember-dx" as string]: `${p.driftX}px`,
            ["--ember-dy" as string]: `${p.riseY}px`,
            animationDelay: `${p.delay}ms`,
            animationDuration: `${p.duration}ms`,
          }}
        />
      ))}
    </div>
  );
}
