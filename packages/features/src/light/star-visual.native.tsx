// src/light/star-visual.native.tsx
//
// NATIVE star/celestial-body visual — a SIMPLIFIED reimplementation of the web
// `star-visual.tsx` (a ~1400-line hand-tuned <svg> with per-tier filters,
// animated <animate>/<animateTransform> keyframe choreography, and elaborate
// multi-layer compositing).
//
// SIMPLIFICATION TRADEOFF (intentional, documented):
//   The web file leans on SVG features react-native-svg either lacks or makes
//   expensive: feGaussianBlur/feMerge filter glows, dozens of per-element
//   SMIL <animate>/<animateTransform> loops, and tier-specific bespoke shapes.
//   Reproducing all of that on native would be heavy and brittle. Instead this
//   file renders, per tier, the SAME SILHOUETTE + SAME COLORS at a coarser
//   fidelity:
//     - a layered radial glow: 2–3 concentric <Circle>s in the tier color at
//       decreasing opacity (stands in for the blur halo),
//     - a central star/burst: an 8-point <Polygon> filled with a
//       <RadialGradient> through the tier's core→mid→outer colors,
//     - a gentle continuous pulse (Tamagui <View> scale transition) when
//       `animate` — no per-particle SMIL.
//   Net: the same recognizable shape and palette, far simpler rendering. The
//   web file remains the high-fidelity reference for large hero displays.
//
// Public contract is identical to the web file: { tier, size, animate }.

import { useEffect, useRef, useState } from "react";
import Svg, {
  Circle,
  Defs,
  Polygon,
  RadialGradient,
  Stop,
} from "react-native-svg";
import { View } from "@stageholder/ui";

interface StarVisualProps {
  tier: number;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  animate?: boolean;
}

// Same px size map as the web file.
const SIZES = { xs: 20, sm: 32, md: 48, lg: 64, xl: 96 };

// Per-tier palette distilled from the web file's dominant gradient stops:
// [core (hot center), mid (body), outer (halo)]. Same hues, fewer stops.
const TIER_PALETTE: Record<number, [string, string, string]> = {
  1: ["#ffffff", "#cbd5e1", "#94a3b8"], // Stargazer — silver
  2: ["#ffffff", "#ef4444", "#7f1d1d"], // Spark — red
  3: ["#fbbf24", "#f59e0b", "#7f1d1d"], // Ember — amber→red
  4: ["#fef3c7", "#f97316", "#dc2626"], // Flame — orange
  5: ["#ffffff", "#f97316", "#ea580c"], // Radiant — orange-gold
  6: ["#fde68a", "#eab308", "#a16207"], // Flare — yellow-gold
  7: ["#fef9c3", "#fbbf24", "#93c5fd"], // Nova — gold + blue-white
  8: ["#fef9c3", "#fde68a", "#22d3ee"], // Pulsar — gold + cyan
  9: ["#fde68a", "#eab308", "#a78bfa"], // Supernova — gold + violet
  10: ["#fef3c7", "#fbbf24", "#f59e0b"], // Meridian — white-gold
};

// 8-point star polygon in the 0..100 viewBox (matches the burst silhouette the
// web file uses for the higher tiers). Alternating outer/inner radii from a
// center of (50,50).
function starPoints(): string {
  const cx = 50;
  const cy = 50;
  const outer = 44;
  const inner = 18;
  const spikes = 8;
  const pts: string[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    // Start at 12 o'clock (−90°) so a spike points straight up.
    const angle = (Math.PI / spikes) * i - Math.PI / 2;
    pts.push(`${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`);
  }
  return pts.join(" ");
}

export function StarVisual({
  tier,
  size = "md",
  animate = true,
}: StarVisualProps) {
  const t = Math.max(1, Math.min(10, tier));
  const px = SIZES[size];
  const [core, mid, outer] = TIER_PALETTE[t] ?? TIER_PALETTE[1]!;
  // Gradient id must be globally unique: react-native-svg puts <RadialGradient
  // id>s in ONE app-wide namespace (unlike the browser, where each <svg> scopes
  // its own <defs>), so a (tier,size) key alone would let two same-tier stars
  // on screen shadow each other's gradient. Mint a random suffix once per
  // instance via useRef — stable across re-renders, unique across instances,
  // and (unlike useState) doesn't trigger a re-render.
  const gradIdRef = useRef(
    `star-grad-${t}-${size}-${Math.random().toString(36).slice(2, 6)}`,
  );
  const gradId = gradIdRef.current;

  // Gentle continuous pulse: toggle a scale flag on an interval; the Tamagui
  // <View> `transition` tweens between the two scales. Replaces the web file's
  // dense SMIL choreography with one breathing motion. No-op when !animate.
  const [pulsed, setPulsed] = useState(false);
  useEffect(() => {
    if (!animate) return;
    const id = setInterval(() => setPulsed((p) => !p), 1500);
    return () => clearInterval(id);
  }, [animate]);

  return (
    <View
      width={px}
      height={px}
      items="center"
      justify="center"
      transition="slow"
      scale={animate ? (pulsed ? 1.06 : 1) : 1}
    >
      <Svg width={px} height={px} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={gradId} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={core} stopOpacity={1} />
            <Stop offset="55%" stopColor={mid} stopOpacity={0.95} />
            <Stop offset="100%" stopColor={outer} stopOpacity={0.7} />
          </RadialGradient>
        </Defs>

        {/* Layered radial glow — concentric halos in the tier hue at
            decreasing opacity (stands in for the web blur filter). */}
        <Circle cx={50} cy={50} r={48} fill={outer} opacity={0.1} />
        <Circle cx={50} cy={50} r={36} fill={mid} opacity={0.15} />
        <Circle cx={50} cy={50} r={24} fill={mid} opacity={0.25} />

        {/* Central burst — 8-point star filled with the tier core→mid→outer
            radial gradient. Same silhouette as the web higher-tier bursts. */}
        <Polygon points={starPoints()} fill={`url(#${gradId})`} />

        {/* Hot center — a small white-ish core dot. */}
        <Circle cx={50} cy={50} r={8} fill={core} opacity={0.95} />
        <Circle cx={50} cy={50} r={3.5} fill="#ffffff" opacity={0.9} />
      </Svg>
    </View>
  );
}
