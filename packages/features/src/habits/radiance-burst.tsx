import { useMemo } from "react";
import { View } from "@stageholder/ui";

// Warm amber/gold palette — resolved HEX so it renders on web AND native
// (react-native-svg / RN styles can't resolve oklch or CSS vars). One palette,
// both platforms.
const RADIANCE_COLORS = [
  "#f5c542", // warm amber
  "#e0a020", // deep gold
  "#f7de6a", // bright yellow
  "#e08a2a", // rich amber
  "#fbeec1", // soft cream
  "#f0b83c", // golden light
];

// Node counts — kept modest on purpose. Every ray/spark/glow is ONE animated
// node; on native each becomes a Reanimated spring (see the tamagui config's
// v5-reanimated driver), so the total count is the single biggest perf lever.
// Reducing these thins the burst equally on web + native → parity holds.
const RAY_COUNT = 8;
const SPARK_COUNT = 10;

interface Ray {
  angle: number;
  length: number;
  width: number;
  delay: number;
  color: string;
}
interface Spark {
  dx: number;
  dy: number;
  size: number;
  delay: number;
  color: string;
}

/**
 * Habit-completion sunburst — warm light rays fan out + golden sparks drift
 * OUTWARD from the CENTER OF ITS PARENT (the check-in control), not the screen.
 *
 * ONE cross-platform source of truth (PWA + native). The trick that makes a
 * single file perform well on BOTH Tamagui drivers is discipline about WHICH
 * properties animate:
 *
 *   • ONLY `opacity` + `transform` (scale / scaleY / x / y) are animated. These
 *     are the two properties the browser compositor AND Reanimated's UI thread
 *     accelerate OFF the main thread. The previous native version animated
 *     `height` (a LAYOUT property) — cheap as a CSS transition, but expensive on
 *     native because every frame re-runs layout. That was the core of the lag.
 *   • Every node is a simple enter→base transition where the BASE state is the
 *     "gone" state (opacity 0). On mount Tamagui applies `enterStyle` (visible)
 *     then animates to the resting props (invisible) — so the burst flashes
 *     outward and self-cleans to nothing, no exit-presence / AnimatePresence
 *     needed (which is unreliable under the PWA's disableExtraction runtime CSS).
 *   • The static rotation/position of each ray lives on an OUTER wrapper; only
 *     the inner node carries animated transform props — so Tamagui never has to
 *     reconcile a static `style.transform` array against animated shorthands.
 *
 * ANCHORED, not full-screen: renders `position:absolute` filling its relative
 * parent, so the host places it inside the control's `position:relative` wrapper
 * and the burst emanates from that button. Mounts on `active` so each completion
 * replays the burst.
 */
export function RadianceBurst({
  active,
  color = "#e0a020",
}: {
  active: boolean;
  /** Habit's own accent, mixed into the center glow. */
  color?: string;
}) {
  const rays = useMemo<Ray[]>(
    () =>
      Array.from({ length: RAY_COUNT }, (_, i) => ({
        angle: (360 / RAY_COUNT) * i + (Math.random() - 0.5) * 18,
        length: 24 + Math.random() * 18,
        width: 2 + Math.random() * 1.5,
        delay: Math.random() * 120,
        color: RADIANCE_COLORS[i % RADIANCE_COLORS.length]!,
      })),
    [],
  );
  const sparks = useMemo<Spark[]>(
    () =>
      Array.from({ length: SPARK_COUNT }, (_, i) => {
        const a = Math.random() * Math.PI * 2;
        const dist = 18 + Math.random() * 26;
        return {
          dx: Math.cos(a) * dist,
          dy: Math.sin(a) * dist - 8, // slight upward bias
          size: 3 + Math.random() * 3,
          delay: 40 + Math.random() * 200,
          color: RADIANCE_COLORS[i % RADIANCE_COLORS.length]!,
        };
      }),
    [],
  );

  if (!active) return null;

  return (
    <View
      position="absolute"
      t={0}
      l={0}
      r={0}
      b={0}
      items="center"
      justify="center"
      pointerEvents="none"
      aria-hidden
      style={{ overflow: "visible" }}
    >
      {/* Center glow — expands + fades. enter(small, visible) → base(big, gone). */}
      <View
        position="absolute"
        width={56}
        height={56}
        rounded={9999}
        opacity={0}
        scale={1.8}
        transition="medium"
        enterStyle={{ opacity: 0.55, scale: 0.4 }}
        style={{ backgroundColor: `${color}55` }}
      />

      {/* Light rays — thin bars that shoot outward + fade. The wrapper holds the
          STATIC rotate + radial offset; the inner node animates scaleY+opacity
          only, so growth composes inside the rotated frame with no layout work.
          enter(short, bright) → base(full length, gone). */}
      {rays.map((r, i) => (
        <View
          key={`ray-${i}`}
          position="absolute"
          style={{
            transform: [
              { rotate: `${r.angle}deg` },
              { translateY: -(r.length / 2 + 8) },
            ],
          }}
        >
          <View
            width={r.width}
            height={r.length}
            rounded={r.width}
            opacity={0}
            scaleY={1}
            transition={["medium", { delay: r.delay }] as never}
            enterStyle={{ opacity: 0.9, scaleY: 0.3 }}
            style={{ backgroundColor: r.color }}
          />
        </View>
      ))}

      {/* Sparkle particles — drift OUTWARD + up while shrinking + fading.
          enter(center, full, bright) → base(offset, small, gone). */}
      {sparks.map((s, i) => (
        <View
          key={`spark-${i}`}
          position="absolute"
          width={s.size}
          height={s.size}
          rounded={9999}
          opacity={0}
          x={s.dx}
          y={s.dy}
          scale={0.2}
          transition={["slow", { delay: s.delay }] as never}
          enterStyle={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          style={{ backgroundColor: s.color }}
        />
      ))}
    </View>
  );
}
