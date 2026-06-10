// src/light/star-visual.native.tsx
//
// NATIVE star/celestial-body visual. Each tier is a DISTINCT design — the
// native rendition of the web file's bespoke per-tier identities (the
// ~1400-line SVG reference), rebuilt from react-native-svg primitives (no
// filters / SMIL):
//
//    1 STARGAZER  — a lone slim twinkle in a quiet night sky (distant dots)
//    2 SPARK      — crackling electric cross-spark with flung crackle dots
//    3 EMBER      — a glowing coal with embers rising off it
//    4 FLAME      — a dancing teardrop flame over a blue-hot base
//    5 RADIANT    — a blazing sun with a triangular corona
//    6 FLARE      — eruption: long curved prominences off a hot core
//    7 NOVA       — a 12-point detonation inside a blue-white shock ring
//    8 PULSAR     — gold core, opposing cyan beams, a tilted orbit ring
//    9 SUPERNOVA  — a grand burst seated in a violet nebula with debris
//   10 MERIDIAN   — the sigil: long compass star, halo ring, cardinal gems
//
// The grandeur deliberately ESCALATES with tier (more layers, rings,
// ornament) so levelling up reads as a reveal, game-style — not a recolor.
//
// Still intentionally simpler than web: layered opacity circles stand in
// for blur glows, and the one continuous motion is the Tamagui scale pulse.
// Public contract unchanged: { tier, size, animate }.

import { useEffect, useRef, useState } from "react";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  Path,
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
// [core (hot center), mid (body), outer (halo/accent)].
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

/** N-point star polygon around (50,50), first spike pointing up. */
function star(
  spikes: number,
  outer: number,
  inner: number,
  rotateDeg = 0,
): string {
  const pts: string[] = [];
  const rot = (rotateDeg * Math.PI) / 180;
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / spikes) * i - Math.PI / 2 + rot;
    pts.push(`${50 + Math.cos(angle) * r},${50 + Math.sin(angle) * r}`);
  }
  return pts.join(" ");
}

/** One triangular sun ray: tip at radius `tip`, base width `w` at `base`. */
function ray(angleDeg: number, base: number, tip: number, w: number): string {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  const perp = a + Math.PI / 2;
  const bx = 50 + Math.cos(a) * base;
  const by = 50 + Math.sin(a) * base;
  const tx = 50 + Math.cos(a) * tip;
  const ty = 50 + Math.sin(a) * tip;
  const ox = (Math.cos(perp) * w) / 2;
  const oy = (Math.sin(perp) * w) / 2;
  return `${bx + ox},${by + oy} ${tx},${ty} ${bx - ox},${by - oy}`;
}

export function StarVisual({
  tier,
  size = "md",
  animate = true,
}: StarVisualProps) {
  const t = Math.max(1, Math.min(10, tier));
  const px = SIZES[size];
  const [core, mid, outer] = TIER_PALETTE[t] ?? TIER_PALETTE[1]!;
  // Unique gradient id per instance — react-native-svg keeps ONE app-wide
  // id namespace (two same-tier stars would shadow each other otherwise).
  const gradIdRef = useRef(
    `star-grad-${t}-${size}-${Math.random().toString(36).slice(2, 6)}`,
  );
  const gradId = gradIdRef.current;
  const fill = `url(#${gradId})`;

  // Gentle continuous pulse (Tamagui scale tween) — the one ambient motion.
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

        {/* Shared ambient glow — two soft halos under every body. */}
        <Circle cx={50} cy={50} r={46} fill={outer} opacity={0.08} />
        <Circle cx={50} cy={50} r={32} fill={mid} opacity={0.14} />

        {t === 1 && (
          <>
            {/* STARGAZER — one slim twinkle, alone among distant stars. */}
            <Circle cx={18} cy={26} r={1.6} fill={mid} opacity={0.5} />
            <Circle cx={80} cy={20} r={1.2} fill={mid} opacity={0.4} />
            <Circle cx={74} cy={76} r={1.4} fill={mid} opacity={0.45} />
            <Circle cx={26} cy={70} r={1} fill={mid} opacity={0.35} />
            <Polygon points={star(4, 40, 6)} fill={fill} />
            <Polygon points={star(4, 18, 4, 45)} fill={core} opacity={0.55} />
            <Circle cx={50} cy={50} r={4} fill={core} opacity={0.95} />
          </>
        )}

        {t === 2 && (
          <>
            {/* SPARK — two offset cross-sparks crackling against each other,
                with flung crackle dots at the diagonals. */}
            <Polygon points={star(4, 42, 7, 45)} fill={outer} opacity={0.55} />
            <Polygon points={star(4, 38, 6)} fill={fill} />
            <Circle cx={78} cy={24} r={2.4} fill={mid} opacity={0.8} />
            <Circle cx={23} cy={73} r={2} fill={mid} opacity={0.7} />
            <Circle cx={27} cy={25} r={1.6} fill={core} opacity={0.8} />
            <Circle cx={75} cy={72} r={1.6} fill={core} opacity={0.7} />
            <Circle cx={50} cy={50} r={5} fill={core} opacity={0.95} />
          </>
        )}

        {t === 3 && (
          <>
            {/* EMBER — a heavy glowing coal, embers drifting up off it. */}
            <Circle cx={50} cy={58} r={26} fill={fill} />
            <Circle cx={50} cy={58} r={15} fill={core} opacity={0.85} />
            <Circle cx={42} cy={30} r={2.6} fill={mid} opacity={0.85} />
            <Circle cx={58} cy={22} r={2} fill={mid} opacity={0.65} />
            <Circle cx={66} cy={34} r={1.6} fill={core} opacity={0.6} />
            <Circle cx={35} cy={18} r={1.4} fill={core} opacity={0.45} />
          </>
        )}

        {t === 4 && (
          <>
            {/* FLAME — dancing teardrop over a blue-hot base. */}
            <Ellipse
              cx={50}
              cy={80}
              rx={16}
              ry={6}
              fill="#60a5fa"
              opacity={0.65}
            />
            <Path
              d="M50 10 C66 32 75 46 73 61 C71 77 62 87 50 87 C38 87 29 77 27 61 C25 46 34 32 50 10 Z"
              fill={fill}
            />
            <Path
              d="M50 38 C58 49 62 56 61 64 C60 73 56 78 50 78 C44 78 40 73 39 64 C38 56 42 49 50 38 Z"
              fill={core}
              opacity={0.9}
            />
          </>
        )}

        {t === 5 && (
          <>
            {/* RADIANT — blazing sun, alternating long/short corona rays. */}
            {Array.from({ length: 12 }, (_, i) => (
              <Polygon
                key={i}
                points={ray(
                  i * 30,
                  24,
                  i % 2 === 0 ? 47 : 38,
                  i % 2 === 0 ? 7 : 5,
                )}
                fill={i % 2 === 0 ? mid : outer}
                opacity={i % 2 === 0 ? 0.95 : 0.7}
              />
            ))}
            <Circle cx={50} cy={50} r={21} fill={fill} />
            <Circle cx={50} cy={50} r={9} fill={core} opacity={0.95} />
          </>
        )}

        {t === 6 && (
          <>
            {/* FLARE — solar eruption: curved prominences whipping off the
                core, a hot streak crossing the disc. */}
            <Path
              d="M62 40 C82 28 90 36 84 50 C80 60 70 60 64 54"
              stroke={mid}
              strokeWidth={4}
              strokeLinecap="round"
              fill="none"
              opacity={0.85}
            />
            <Path
              d="M40 62 C22 72 14 64 19 51 C23 42 32 41 38 47"
              stroke={outer}
              strokeWidth={3}
              strokeLinecap="round"
              fill="none"
              opacity={0.7}
            />
            <Polygon points={star(8, 36, 13)} fill={fill} />
            <Ellipse
              cx={50}
              cy={50}
              rx={42}
              ry={3}
              fill={core}
              opacity={0.35}
            />
            <Circle cx={50} cy={50} r={10} fill={core} opacity={0.95} />
          </>
        )}

        {t === 7 && (
          <>
            {/* NOVA — sharp 12-point detonation inside a blue-white shock
                ring, shards thrown past it. */}
            <Circle
              cx={50}
              cy={50}
              r={44}
              stroke={outer}
              strokeWidth={1.5}
              fill="none"
              opacity={0.6}
            />
            <Polygon points={star(12, 40, 14)} fill={fill} />
            <Polygon points={star(4, 12, 3, 45)} fill="#ffffff" opacity={0.8} />
            <Circle cx={14} cy={36} r={1.8} fill={outer} opacity={0.8} />
            <Circle cx={86} cy={62} r={1.8} fill={outer} opacity={0.8} />
            <Circle cx={62} cy={12} r={1.5} fill="#ffffff" opacity={0.7} />
            <Circle cx={50} cy={50} r={6} fill="#ffffff" opacity={0.95} />
          </>
        )}

        {t === 8 && (
          <>
            {/* PULSAR — opposing cyan beams sweeping from a dense gold core,
                a tilted orbit ring around it. */}
            <Polygon points="47,50 50,2 53,50" fill={outer} opacity={0.85} />
            <Polygon points="47,50 50,98 53,50" fill={outer} opacity={0.85} />
            <Ellipse
              cx={50}
              cy={50}
              rx={38}
              ry={13}
              stroke={outer}
              strokeWidth={1.5}
              fill="none"
              opacity={0.55}
              rotation={-28}
              origin="50,50"
            />
            <Circle cx={50} cy={50} r={14} fill={fill} />
            <Circle cx={50} cy={50} r={6} fill={core} opacity={1} />
            <Circle cx={50} cy={50} r={2.5} fill="#ffffff" />
          </>
        )}

        {t === 9 && (
          <>
            {/* SUPERNOVA — a grand burst seated in a violet nebula, debris
                ring flung wide. */}
            <Circle cx={32} cy={62} r={16} fill={outer} opacity={0.25} />
            <Circle cx={68} cy={36} r={13} fill={outer} opacity={0.22} />
            <Circle cx={62} cy={70} r={10} fill={outer} opacity={0.18} />
            <Polygon points={star(12, 46, 15)} fill={fill} />
            <Polygon points={star(6, 24, 9, 30)} fill={core} opacity={0.8} />
            <Circle cx={10} cy={50} r={1.8} fill={outer} opacity={0.8} />
            <Circle cx={90} cy={44} r={1.6} fill={outer} opacity={0.8} />
            <Circle cx={70} cy={9} r={1.5} fill={core} opacity={0.7} />
            <Circle cx={26} cy={88} r={1.5} fill={core} opacity={0.6} />
            <Circle cx={50} cy={50} r={5} fill="#ffffff" opacity={0.95} />
          </>
        )}

        {t === 10 && (
          <>
            {/* MERIDIAN — the sigil: a long compass star through a halo
                ring, gem points at the cardinals. Transcendence as order. */}
            <Circle
              cx={50}
              cy={50}
              r={40}
              stroke={mid}
              strokeWidth={1.2}
              fill="none"
              opacity={0.55}
            />
            <Polygon points={star(4, 48, 6)} fill={fill} />
            <Polygon points={star(4, 30, 5, 45)} fill={mid} opacity={0.75} />
            <Polygon
              points={star(4, 10, 3, 45)}
              fill="#ffffff"
              opacity={0.85}
            />
            {(
              [
                [50, 10],
                [90, 50],
                [50, 90],
                [10, 50],
              ] as const
            ).map(([cx, cy], i) => (
              <Polygon
                key={i}
                points={`${cx},${cy - 3} ${cx + 3},${cy} ${cx},${cy + 3} ${cx - 3},${cy}`}
                fill={core}
                opacity={0.9}
              />
            ))}
            <Circle cx={50} cy={50} r={4} fill="#ffffff" />
          </>
        )}
      </Svg>
    </View>
  );
}
