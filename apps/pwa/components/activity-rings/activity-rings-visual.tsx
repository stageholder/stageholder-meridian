"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { StarVisual } from "@/components/light/star-visual";
import { Check, Zap, PenLine } from "lucide-react";

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
  xs: { px: 24, stroke: 5, gap: 0.5 },
  sm: { px: 32, stroke: 6, gap: 0.5 },
  md: { px: 48, stroke: 8, gap: 1 },
  lg: { px: 96, stroke: 9, gap: 1.5 },
  xl: { px: 160, stroke: 12, gap: 2 },
};

// Progressive cool scheme — blue → teal → green
const RING_COLORS = {
  todo:         { color: "var(--ring-todo)", track: "var(--ring-todo-track)" },
  habit:        { color: "var(--ring-habit)", track: "var(--ring-habit-track)" },
  journal:      { color: "var(--ring-journal)", track: "var(--ring-journal-track)" },
};

type RingType = "todo" | "habit" | "journal";

interface RingConfig {
  radius: number;
  color: string;
  trackColor: string;
  percent: number;
  delay: number;
  type: RingType;
}

function computeRings(stroke: number, gap: number, data: ActivityRingsData): RingConfig[] {
  const outerR = 50 - stroke / 2;
  const middleR = outerR - stroke - gap;
  const innerR = middleR - stroke - gap;

  return [
    { radius: outerR, color: RING_COLORS.journal.color, trackColor: RING_COLORS.journal.track, percent: data.journal, delay: 300, type: "journal" as RingType },
    { radius: middleR, color: RING_COLORS.habit.color, trackColor: RING_COLORS.habit.track, percent: data.habit, delay: 150, type: "habit" as RingType },
    { radius: innerR, color: RING_COLORS.todo.color, trackColor: RING_COLORS.todo.track, percent: data.todo, delay: 0, type: "todo" as RingType },
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

const RING_ICONS: Record<RingType, React.ComponentType<React.SVGProps<SVGSVGElement> & { size?: number }>> = {
  todo: Check,
  habit: Zap,
  journal: PenLine,
};

function getArcEndpoint(radius: number, percent: number) {
  const angleDeg = -90 + (percent / 100) * 360;
  const angleRad = angleDeg * (Math.PI / 180);
  return {
    x: 50 + radius * Math.cos(angleRad),
    y: 50 + radius * Math.sin(angleRad),
  };
}

export function ActivityRingsVisual({ data, size = "md", animate = true, star, className }: ActivityRingsVisualProps) {
  const { px, stroke, gap } = SIZE_CONFIG[size];
  const rings = computeRings(stroke, gap, data);
  const [mounted, setMounted] = useState(!animate);

  useEffect(() => {
    if (!animate || mounted) return;
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <defs>
        <filter id="end-cap-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="1.5" dy="0" stdDeviation="1.5" floodColor="#000" floodOpacity="0.5" />
        </filter>
      </defs>
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
              strokeWidth={stroke}
              style={{ stroke: ring.trackColor }}
            />
            <circle
              cx={50}
              cy={50}
              r={ring.radius}
              fill="none"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90 50 50)"
              style={{
                stroke: ring.color,
                ...(animate ? { transition: `stroke-dashoffset 1200ms ease-out` } : {}),
              }}
            />
          </g>
        );
      })}
      {(size === "lg" || size === "xl") && rings.map((ring, i) => {
        let pct = Math.max(0, Math.min(100, ring.percent));
        if (pct <= 0) return null;
        if (pct < 5) {
          const circumference = 2 * Math.PI * ring.radius;
          const minArc = stroke * 2;
          const minPct = (minArc / circumference) * 100;
          pct = Math.max(pct, minPct);
        }
        const { x, y } = getArcEndpoint(ring.radius, pct);
        const capR = stroke / 2;
        const Icon = RING_ICONS[ring.type];
        const iconPx = capR * 1.2;

        return (
          <g
            key={`icon-${i}`}
            filter="url(#end-cap-shadow)"
            style={{
              opacity: mounted ? 1 : 0,
              transition: animate ? "opacity 400ms ease-out 1200ms" : undefined,
            }}
          >
            <circle cx={x} cy={y} r={capR} style={{ fill: ring.color }} />
            <foreignObject
              x={x - capR}
              y={y - capR}
              width={capR * 2}
              height={capR * 2}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>
                <Icon size={iconPx} color="rgba(0,0,0,0.7)" strokeWidth={3} />
              </div>
            </foreignObject>
          </g>
        );
      })}
      {(() => {
        const innerRing = rings[rings.length - 1];
        if (!innerRing) return null;
        const centerSpace = (innerRing.radius - stroke / 2) * 2;
        const offset = 50 - centerSpace / 2;
        if (star) {
          const starSize = STAR_SIZE_MAP[size];
          return (
            <foreignObject x={offset} y={offset} width={centerSpace} height={centerSpace}>
              <div className="flex h-full w-full items-center justify-center">
                <StarVisual tier={star.tier} size={starSize} animate={animate} />
              </div>
            </foreignObject>
          );
        }
        const fontSize = centerSpace * 0.55;
        return (
          <text
            x={50}
            y={50}
            textAnchor="middle"
            dominantBaseline="central"
            style={{ fontSize }}
          >
            🔥
          </text>
        );
      })()}
    </svg>
  );
}
