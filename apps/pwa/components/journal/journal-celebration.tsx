"use client";

import { useEffect, useMemo, useState } from "react";

const SPARK_COLORS = [
  "oklch(0.88 0.18 85)", // bright gold
  "oklch(0.82 0.22 75)", // warm amber
  "oklch(0.78 0.16 55)", // deep gold
  "oklch(0.92 0.10 90)", // pale yellow
  "oklch(0.70 0.20 45)", // orange-gold
  "oklch(0.95 0.08 95)", // cream sparkle
  "oklch(0.85 0.14 130)", // mint accent
];

const FIRE_COLORS = [
  "oklch(0.72 0.22 40)", // bright orange
  "oklch(0.65 0.26 30)", // deep orange-red
  "oklch(0.78 0.18 55)", // amber
  "oklch(0.58 0.24 25)", // burnt red
  "oklch(0.82 0.16 70)", // golden yellow
  "oklch(0.50 0.20 20)", // deep ember
  "oklch(0.85 0.20 50)", // light flame
  "oklch(0.68 0.28 35)", // hot orange
];

interface Particle {
  id: number;
  x: number;
  startY: number;
  dx: number;
  dy: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  glow: number;
}

interface JournalCelebrationProps {
  trigger: number;
}

export function JournalCelebration({ trigger }: JournalCelebrationProps) {
  const [active, setActive] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  // Gold sparkle particles (spread across the editor)
  const sparks = useMemo(() => {
    if (trigger === 0) return [];
    return Array.from({ length: 40 }, (_, i): Particle => {
      const color =
        SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)]!;
      const size = 3 + Math.random() * 6;
      return {
        id: i,
        x: Math.random() * 100,
        startY: 70 + Math.random() * 30,
        dx: (Math.random() - 0.5) * 120,
        dy: -(60 + Math.random() * 140),
        size,
        color,
        delay: Math.random() * 400,
        duration: 800 + Math.random() * 600,
        glow: size + 4,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  // Fire ember particles (rise from the very bottom like a bonfire)
  const embers = useMemo(() => {
    if (trigger === 0) return [];
    return Array.from({ length: 28 }, (_, i): Particle => {
      const color =
        FIRE_COLORS[Math.floor(Math.random() * FIRE_COLORS.length)]!;
      const size = 3 + Math.random() * 5;
      return {
        id: i + 100,
        x: 5 + Math.random() * 90, // spread across full width
        startY: 95 + Math.random() * 8, // start from bottom edge
        dx: (Math.random() - 0.5) * 60,
        dy: -(80 + Math.random() * 180), // rise higher
        size,
        color,
        delay: Math.random() * 600, // more staggered for lingering effect
        duration: 900 + Math.random() * 800,
        glow: size + 6,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  // Second wave of embers (delayed eruption)
  const embers2 = useMemo(() => {
    if (trigger === 0) return [];
    return Array.from({ length: 16 }, (_, i): Particle => {
      const color =
        FIRE_COLORS[Math.floor(Math.random() * FIRE_COLORS.length)]!;
      const size = 2 + Math.random() * 4;
      return {
        id: i + 200,
        x: 10 + Math.random() * 80,
        startY: 96 + Math.random() * 6,
        dx: (Math.random() - 0.5) * 50,
        dy: -(50 + Math.random() * 120),
        size,
        color,
        delay: 500 + Math.random() * 500, // second wave
        duration: 700 + Math.random() * 600,
        glow: size + 3,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  useEffect(() => {
    if (trigger === 0) return;
    setActive(true);
    const bannerTimer = setTimeout(() => setShowBanner(true), 200);
    const hideBanner = setTimeout(() => setShowBanner(false), 2800);
    const hideAll = setTimeout(() => setActive(false), 3500);
    return () => {
      clearTimeout(bannerTimer);
      clearTimeout(hideBanner);
      clearTimeout(hideAll);
    };
  }, [trigger]);

  if (!active) return null;

  const allEmbers = [...embers, ...embers2];

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20"
      aria-hidden="true"
      style={{ overflow: "hidden" }}
    >
      {/* Golden flash overlay */}
      <div className="journal-celebration-flash absolute inset-0" />

      {/* Shimmer sweep */}
      <div className="journal-celebration-shimmer absolute inset-0" />

      {/* Fire glow along the bottom edge */}
      <div className="journal-fire-edge absolute bottom-0 left-0 right-0" />

      {/* Fire ember particles — rising from the bottom */}
      {allEmbers.map((e) => (
        <span
          key={e.id}
          className="absolute rounded-full journal-ember"
          style={{
            left: `${e.x}%`,
            top: `${e.startY}%`,
            width: e.size,
            height: e.size,
            backgroundColor: e.color,
            boxShadow: `0 0 ${e.glow}px ${e.color}, 0 0 ${e.glow * 2}px ${e.color}`,
            ["--ember-dx" as string]: `${e.dx}px`,
            ["--ember-dy" as string]: `${e.dy}px`,
            animationDelay: `${e.delay}ms`,
            animationDuration: `${e.duration}ms`,
          }}
        />
      ))}

      {/* Gold spark particles */}
      {sparks.map((s) => (
        <span
          key={s.id}
          className="absolute rounded-full journal-spark"
          style={{
            left: `${s.x}%`,
            top: `${s.startY}%`,
            width: s.size,
            height: s.size,
            backgroundColor: s.color,
            boxShadow: `0 0 ${s.glow}px ${s.color}`,
            ["--spark-dx" as string]: `${s.dx}px`,
            ["--spark-dy" as string]: `${s.dy}px`,
            animationDelay: `${s.delay}ms`,
            animationDuration: `${s.duration}ms`,
          }}
        />
      ))}

      {/* Target reached banner */}
      {showBanner && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="journal-celebration-banner flex flex-col items-center gap-1">
            <span
              className="text-lg font-bold"
              style={{ color: "oklch(0.82 0.22 75)" }}
            >
              Target Reached!
            </span>
            <span
              className="text-xs"
              style={{ color: "oklch(0.70 0.15 75 / 0.8)" }}
            >
              Keep the flow going
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
