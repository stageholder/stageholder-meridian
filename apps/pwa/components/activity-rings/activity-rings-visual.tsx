"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { StarVisual } from "@/components/light/star-visual";

export interface ActivityRingsData {
  todo: number;   // 0-100
  habit: number;  // 0-100
  journal: number; // 0 or 100
}

export type ActivityRingsSize = "xs" | "sm" | "md" | "lg" | "xl";

interface ActivityRingsVisualProps {
  data: ActivityRingsData;
  size?: ActivityRingsSize;
  animate?: boolean;
  star?: { tier: number };
  className?: string;
}

const SIZE_CONFIG: Record<ActivityRingsSize, { px: number; stroke: number; gap: number }> = {
  xs: { px: 24, stroke: 2.5, gap: 1 },
  sm: { px: 32, stroke: 3, gap: 1.5 },
  md: { px: 48, stroke: 4, gap: 2 },
  lg: { px: 96, stroke: 5, gap: 3 },
  xl: { px: 160, stroke: 6, gap: 4 },
};

// Direct colors — blue for todos, orange for habits, green for journal
const RING_COLORS = {
  todo:         { color: "#3b82f6", track: "rgba(59, 130, 246, 0.2)" },
  habit:        { color: "#f97316", track: "rgba(249, 115, 22, 0.2)" },
  journal:      { color: "#22c55e", track: "rgba(34, 197, 94, 0.2)" },
};

interface RingConfig {
  radius: number;
  color: string;
  trackColor: string;
  percent: number;
  delay: number;
}

function computeRings(stroke: number, gap: number, data: ActivityRingsData): RingConfig[] {
  const outerR = 50 - stroke / 2;
  const middleR = outerR - stroke - gap;
  const innerR = middleR - stroke - gap;

  return [
    { radius: outerR, color: RING_COLORS.journal.color, trackColor: RING_COLORS.journal.track, percent: data.journal, delay: 300 },
    { radius: middleR, color: RING_COLORS.habit.color, trackColor: RING_COLORS.habit.track, percent: data.habit, delay: 150 },
    { radius: innerR, color: RING_COLORS.todo.color, trackColor: RING_COLORS.todo.track, percent: data.todo, delay: 0 },
  ];
}

export { RING_COLORS };

const STAR_SIZE_MAP: Record<ActivityRingsSize, 'sm' | 'md' | 'lg' | 'xl'> = {
  xs: 'sm',
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  xl: 'xl',
};

export function ActivityRingsVisual({ data, size = "md", animate = true, star, className }: ActivityRingsVisualProps) {
  const { px, stroke, gap } = SIZE_CONFIG[size];
  const rings = computeRings(stroke, gap, data);
  const [mounted, setMounted] = useState(!animate);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!animate || hasAnimated.current) return;
    hasAnimated.current = true;
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, [animate]);

  const label = `Activity: Todos ${Math.round(data.todo)}%, Habits ${Math.round(data.habit)}%, Journal ${data.journal > 0 ? "complete" : "incomplete"}`;

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 100 100"
      className={cn("shrink-0", className)}
      role={size === "xs" ? undefined : "img"}
      aria-label={size === "xs" ? undefined : label}
      aria-hidden={size === "xs" ? true : undefined}
    >
      {rings.map((ring, i) => {
        const circumference = 2 * Math.PI * ring.radius;
        let pct = Math.max(0, Math.min(100, ring.percent));
        if (pct > 0 && pct < 5) {
          const minArc = stroke * 2;
          const minPct = (minArc / circumference) * 100;
          pct = Math.max(pct, minPct);
        }
        const offset = circumference * (1 - (mounted ? pct : 0) / 100);

        return (
          <g key={i}>
            <circle
              cx={50}
              cy={50}
              r={ring.radius}
              fill="none"
              stroke={ring.trackColor}
              strokeWidth={stroke}
            />
            <circle
              cx={50}
              cy={50}
              r={ring.radius}
              fill="none"
              stroke={ring.color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90 50 50)"
              style={animate ? {
                transition: `stroke-dashoffset 800ms cubic-bezier(0.34, 1.56, 0.64, 1)`,
                transitionDelay: `${ring.delay}ms`,
              } : undefined}
            />
          </g>
        );
      })}
      {star && (() => {
        const innerRing = rings[rings.length - 1];
        if (!innerRing) return null;
        const centerSpace = (innerRing.radius - stroke / 2) * 2;
        const starSize = STAR_SIZE_MAP[size];
        const offset = 50 - centerSpace / 2;
        return (
          <foreignObject x={offset} y={offset} width={centerSpace} height={centerSpace}>
            <div className="flex h-full w-full items-center justify-center">
              <StarVisual tier={star.tier} size={starSize} animate={animate} />
            </div>
          </foreignObject>
        );
      })()}
    </svg>
  );
}
