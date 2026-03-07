'use client';

import { cn } from '@/lib/utils';

interface StarVisualProps {
  tier: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  animate?: boolean;
  className?: string;
}

const TIER_COLORS: Record<number, { core: string; glow: string; outer: string }> = {
  1: { core: '#94a3b8', glow: '#cbd5e1', outer: '#e2e8f0' },
  2: { core: '#fbbf24', glow: '#fde68a', outer: '#fef3c7' },
  3: { core: '#f59e0b', glow: '#fbbf24', outer: '#fde68a' },
  4: { core: '#ef4444', glow: '#f97316', outer: '#fbbf24' },
  5: { core: '#f97316', glow: '#fbbf24', outer: '#fef3c7' },
  6: { core: '#ec4899', glow: '#f472b6', outer: '#fbcfe8' },
  7: { core: '#8b5cf6', glow: '#a78bfa', outer: '#c4b5fd' },
  8: { core: '#3b82f6', glow: '#60a5fa', outer: '#93c5fd' },
  9: { core: '#f59e0b', glow: '#fbbf24', outer: '#ffffff' },
  10: { core: '#ffffff', glow: '#fbbf24', outer: '#f59e0b' },
};

const SIZES = { sm: 24, md: 40, lg: 56, xl: 80 };

export function StarVisual({ tier, size = 'md', animate = true, className }: StarVisualProps) {
  const clampedTier = Math.max(1, Math.min(10, tier));
  const colors = TIER_COLORS[clampedTier]!;
  const px = SIZES[size];
  const id = `star-${clampedTier}-${size}`;

  const coreRadius = 6 + clampedTier * 0.5;
  const midRadius = coreRadius + 4;
  const outerRadius = midRadius + 6;

  const showOuterGlow = clampedTier >= 4;
  const showMidGlow = clampedTier >= 2;
  const showRays = clampedTier >= 6;
  const rayCount = clampedTier >= 8 ? 8 : 4;
  const showOrbits = clampedTier >= 8;
  const orbitCount = clampedTier >= 9 ? 4 : 2;
  const shouldPulse = animate && clampedTier >= 7;

  const rays: { x1: number; y1: number; x2: number; y2: number }[] = [];
  if (showRays) {
    for (let i = 0; i < rayCount; i++) {
      const angle = (i * 360) / rayCount - 90;
      const rad = (angle * Math.PI) / 180;
      rays.push({
        x1: 50 + Math.cos(rad) * (coreRadius + 2),
        y1: 50 + Math.sin(rad) * (coreRadius + 2),
        x2: 50 + Math.cos(rad) * (midRadius + 2),
        y2: 50 + Math.sin(rad) * (midRadius + 2),
      });
    }
  }

  const orbitDots: { cx: number; cy: number; delay: number }[] = [];
  if (showOrbits) {
    const orbitR = outerRadius - 2;
    for (let i = 0; i < orbitCount; i++) {
      const angle = (i * 360) / orbitCount - 90;
      const rad = (angle * Math.PI) / 180;
      orbitDots.push({
        cx: 50 + Math.cos(rad) * orbitR,
        cy: 50 + Math.sin(rad) * orbitR,
        delay: i * 0.5,
      });
    }
  }

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 100 100"
      className={cn('shrink-0', shouldPulse && 'animate-pulse', className)}
      aria-hidden
    >
      <defs>
        <radialGradient id={`${id}-outer`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={colors.outer} stopOpacity={0.6} />
          <stop offset="100%" stopColor={colors.outer} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${id}-mid`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={colors.glow} stopOpacity={0.5} />
          <stop offset="100%" stopColor={colors.glow} stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* Outer glow - tier 4+ */}
      {showOuterGlow && (
        <circle cx={50} cy={50} r={outerRadius} fill={`url(#${id}-outer)`} />
      )}

      {/* Mid glow - tier 2+ */}
      {showMidGlow && (
        <circle cx={50} cy={50} r={midRadius} fill={`url(#${id}-mid)`} />
      )}

      {/* Rays - tier 6+ */}
      {rays.map((ray, i) => (
        <line
          key={i}
          x1={ray.x1}
          y1={ray.y1}
          x2={ray.x2}
          y2={ray.y2}
          stroke={colors.glow}
          strokeWidth={1.5}
          strokeLinecap="round"
          opacity={0.7}
        />
      ))}

      {/* Core */}
      <circle cx={50} cy={50} r={coreRadius} fill={colors.core} />

      {/* Orbiting dots - tier 8+ */}
      {orbitDots.map((dot, i) => (
        <circle
          key={i}
          cx={dot.cx}
          cy={dot.cy}
          r={1.5}
          fill={colors.glow}
          opacity={0.8}
        >
          {animate && (
            <animateTransform
              attributeName="transform"
              type="rotate"
              from={`0 50 50`}
              to={`360 50 50`}
              dur={`${4 + dot.delay}s`}
              repeatCount="indefinite"
            />
          )}
        </circle>
      ))}
    </svg>
  );
}
