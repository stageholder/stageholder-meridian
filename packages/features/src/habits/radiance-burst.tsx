import { useMemo } from "react";
import { View } from "@stageholder/ui";

// Warm amber/gold palette — resolved HEX so it renders on web AND native
// (react-native-svg / RN styles can't resolve oklch or CSS vars). Same warm
// "radiance" family as the PWA's web RadianceBurst.
const RADIANCE_COLORS = [
  "#f5c542", // warm amber
  "#e0a020", // deep gold
  "#f7de6a", // bright yellow
  "#e08a2a", // rich amber
  "#fbeec1", // soft cream
  "#f0b83c", // golden light
];

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
 * from the CENTER OF ITS PARENT (the check-in control), not the screen.
 *
 * ANCHORED, not full-screen: renders `position:absolute` filling its relative
 * parent, so the host places it inside the control's `position:relative`
 * wrapper and the burst emanates from that button. (Contrast the kit
 * `Celebration`, a Dimensions-based full-VIEWPORT particle emitter meant for
 * big moments via the root provider — using it here is what put the burst in
 * the middle of the screen.)
 *
 * Cross-platform: pure Tamagui `View`s animated via `enterStyle`+`transition`
 * (CSS driver on web, Reanimated on native) — one component, both platforms,
 * mounting on `active` so each completion replays the burst.
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
      Array.from({ length: 10 }, (_, i) => ({
        angle: (360 / 10) * i + (Math.random() - 0.5) * 18,
        length: 22 + Math.random() * 16,
        width: 2 + Math.random() * 1.5,
        delay: Math.random() * 120,
        color: RADIANCE_COLORS[i % RADIANCE_COLORS.length]!,
      })),
    [],
  );
  const sparks = useMemo<Spark[]>(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const a = Math.random() * Math.PI * 2;
        const dist = 16 + Math.random() * 24;
        return {
          dx: Math.cos(a) * dist,
          dy: Math.sin(a) * dist - 6, // slight upward bias
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
      {/* Center glow pulse. */}
      <View
        position="absolute"
        width={56}
        height={56}
        rounded={9999}
        opacity={0}
        scale={0.4}
        transition="medium"
        enterStyle={{ opacity: 0.5, scale: 1.2 }}
        style={{ backgroundColor: `${color}55` }}
      />

      {/* Light rays — thin bars growing outward from center. Each is
          rotated around the shared center and its height animates 0→length. */}
      {rays.map((r, i) => (
        <View
          key={`ray-${i}`}
          position="absolute"
          width={r.width}
          height={0}
          rounded={r.width}
          opacity={0}
          transition={["medium", { delay: r.delay }] as never}
          enterStyle={{ height: r.length, opacity: 0.9 }}
          style={{
            backgroundColor: r.color,
            transform: [
              { rotate: `${r.angle}deg` },
              { translateY: -(r.length / 2 + 8) },
            ],
          }}
        />
      ))}

      {/* Sparkle particles — small dots drifting outward + up. */}
      {sparks.map((s, i) => (
        <View
          key={`spark-${i}`}
          position="absolute"
          width={s.size}
          height={s.size}
          rounded={9999}
          opacity={0}
          transition={["slow", { delay: s.delay }] as never}
          enterStyle={{ x: s.dx, y: s.dy, opacity: 1 }}
          style={{ backgroundColor: s.color }}
        />
      ))}
    </View>
  );
}
