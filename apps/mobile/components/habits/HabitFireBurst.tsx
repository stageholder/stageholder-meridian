// apps/mobile/components/habits/HabitFireBurst.tsx
//
// Card-wide ignition for a habit check-in. The earlier radial burst
// felt small because it only happened at the icon tile — half the
// card stayed visually flat. This version treats the WHOLE CARD as
// the canvas: a column of flames rises from the bottom edge across
// the full width, a warm color wash bathes the card briefly, and
// the border glows. The icon tile's spring pulse (separate hook) is
// still synced to the same trigger.
//
// Composition (all driven by one shared `progress` value on the UI
// thread via Reanimated):
//
//   1. CARD GLOW  — whole-card tint in the habit color, peaks fast
//      and fades over ~700ms. Reads as "the card has ignited".
//   2. BORDER FLASH — a 2pt halo brightening around the card edge,
//      synced to the glow peak.
//   3. RISING FLAMES — ~28 particles seeded along the bottom edge
//      with horizontal jitter. Each rises 55-80% of the card height
//      with a sinusoidal wobble, fades out near the top.
//
// Mount it as a SIBLING of Card.Body inside a position-relative Card,
// with `pointerEvents="none"` so swipe/tap gestures still reach the
// content underneath.

import { useEffect, useMemo, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const BURST_DURATION_MS = 1100;
const GLOW_DURATION_MS = 820;
const PARTICLE_COUNT = 28;

type Particle = {
  /** Absolute x within the card (0 to cardWidth). */
  startX: number;
  /** Distance to rise (negative dy in screen coords). */
  riseHeight: number;
  /** Peak horizontal wobble amplitude in pt. */
  wobble: number;
  /** Particle dot size. */
  size: number;
  /** When (0..1 of progress) the particle starts emitting. */
  delay: number;
  /** How much of the remaining progress it travels over. */
  span: number;
  color: string;
};

/**
 * Generate particle origins distributed across the card's bottom edge
 * with deterministic jitter — same card width always produces the
 * same burst shape, which gives the animation a recognizable
 * signature rather than chaotic randomness.
 */
function buildParticles(
  width: number,
  height: number,
  color: string,
): Particle[] {
  if (width <= 0 || height <= 0) return [];

  // Hot palette: white-yellow core → amber → orange → habit color.
  // Repeating the habit color makes ~a third of the particles brand-
  // tinted so the fire reads as "this habit ignited".
  const palette = ["#fff7ed", "#fde68a", "#fbbf24", "#f97316", color, color];

  const out: Particle[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    // Spread x across the width with a sine-based jitter for natural
    // clumping. Some particles cluster, some are loners — that's how
    // real flames look from a wide hearth.
    const baseX = (i / PARTICLE_COUNT) * width;
    const jitterX = Math.sin(i * 7.3) * (width * 0.06);
    const startX = Math.max(2, Math.min(width - 2, baseX + jitterX));

    // Rise heights vary so the flame "skyline" is uneven — taller
    // peaks, shorter ones nearby. 55–88% of the card height.
    const riseHeight = height * (0.55 + Math.sin(i * 3.1) * 0.17 + 0.16);

    // Sinusoidal wobble amplitude. Cosine of index seeds it, so the
    // distribution is asymmetric (real flames don't wobble uniformly).
    const wobble = 6 + Math.abs(Math.cos(i * 5.7)) * 10;

    const size = 4 + ((i * 11) % 6); // 4–9pt
    const delay = (((i * 13) % 100) / 100) * 0.35; // 0–35% staggered
    const span = 0.55 + ((i * 5) % 30) / 100; // 55–84%

    out.push({
      startX,
      riseHeight,
      wobble,
      size,
      delay,
      span,
      color: palette[i % palette.length]!,
    });
  }
  return out;
}

export type HabitFireBurstProps = {
  /** Any change to this value triggers a new burst. Pass Date.now(). */
  trigger: number | string | null;
  /** Habit color — drives the glow tint + the brand-tinted particles. */
  color?: string;
};

/**
 * Card-wide fire ignition. Mount as a sibling inside a position-
 * relative Card root, with pointerEvents='none' so touches pass
 * through to content beneath.
 */
export function HabitFireBurst({
  trigger,
  color = "#f59e0b",
}: HabitFireBurstProps) {
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const progress = useSharedValue(0);
  const glow = useSharedValue(0);

  const particles = useMemo(
    () => buildParticles(size.w, size.h, color),
    [size.w, size.h, color],
  );

  useEffect(() => {
    if (trigger == null || size.w === 0 || size.h === 0) return;
    // Master driver for all particle motion.
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: BURST_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });
    // Glow rises fast then exhales out — quicker than particles so
    // the wash subsides while flames are still climbing.
    glow.value = withSequence(
      withTiming(1, { duration: 120, easing: Easing.out(Easing.cubic) }),
      withTiming(0, {
        duration: GLOW_DURATION_MS - 120,
        easing: Easing.out(Easing.quad),
      }),
    );
  }, [trigger, size.w, size.h, progress, glow]);

  function handleLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setSize((s) =>
      s.w === width && s.h === height ? s : { w: width, h: height },
    );
  }

  return (
    <View
      pointerEvents="none"
      onLayout={handleLayout}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        overflow: "hidden",
      }}
    >
      {/* Card-wide tint wash. Sits behind the particles so flames
          read as warm against a glowing background, not vice versa. */}
      <CardGlow glow={glow} color={color} />
      {/* Border halo — drawn last so it sits over content edges. */}
      <BorderHalo glow={glow} color={color} />
      {/* Rising flames across the bottom. Each is absolutely positioned
          at its (startX, bottom) and animates translate up. */}
      {particles.map((p, i) => (
        <RisingFlame
          key={i}
          progress={progress}
          particle={p}
          cardHeight={size.h}
        />
      ))}
    </View>
  );
}

/* ----------------------- Card glow (whole-card tint) --------------------- */

function CardGlow({
  glow,
  color,
}: {
  glow: SharedValue<number>;
  color: string;
}) {
  const style = useAnimatedStyle(() => {
    "worklet";
    // Peak alpha ~0.18 — strong enough to feel like a flash, low
    // enough that the underlying content stays readable.
    return { opacity: glow.value * 0.18 };
  });

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

/* ----------------------- Border halo flash ------------------------------- */

function BorderHalo({
  glow,
  color,
}: {
  glow: SharedValue<number>;
  color: string;
}) {
  const style = useAnimatedStyle(() => {
    "worklet";
    return { opacity: glow.value };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          borderWidth: 2,
          borderColor: color,
          borderRadius: 12,
        },
        style,
      ]}
    />
  );
}

/* ----------------------- One rising flame -------------------------------- */

function RisingFlame({
  progress,
  particle,
  cardHeight,
}: {
  progress: SharedValue<number>;
  particle: Particle;
  cardHeight: number;
}) {
  const style = useAnimatedStyle(() => {
    "worklet";
    // Local 0..1 timeline for this particle.
    const t = Math.max(
      0,
      Math.min(1, (progress.value - particle.delay) / particle.span),
    );

    // Rise upward (translateY negative). Easing happens via the parent
    // progress's easing — the particle itself moves linearly inside its
    // window so adjacent particles emit at uniform feel.
    const translateY = -t * particle.riseHeight;

    // Horizontal sinusoidal wobble — flames lick side-to-side. Two full
    // cycles over the particle's lifetime feels lively without dizzy.
    const translateX = Math.sin(t * Math.PI * 2) * particle.wobble;

    // Scale: pop in fast (0→1.1 by t=0.18), gentle taper afterwards
    // so particles look like ember candles, not party balloons.
    const scale =
      t < 0.18
        ? (t / 0.18) * 1.1
        : t < 0.6
          ? 1.1 - (t - 0.18) * 0.12
          : 1.05 - (t - 0.6) * 0.6;

    // Opacity: instant flash, hold, gentle fade near the top.
    const opacity =
      t < 0.12 ? t * 8.33 : t > 0.7 ? Math.max(0, 1 - (t - 0.7) * 3.33) : 1;

    return {
      transform: [{ translateX }, { translateY }, { scale }],
      opacity,
    };
  });

  // Place the particle at its (startX, cardBottom). Margin of 6pt
  // keeps the spawn point just inside the card so the flames look
  // like they're rising from the chrome, not bleeding off-frame.
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: particle.startX - particle.size / 2,
          top: cardHeight - particle.size - 6,
          width: particle.size,
          height: particle.size,
          borderRadius: particle.size / 2,
          backgroundColor: particle.color,
        },
        style,
      ]}
    />
  );
}

/* ----------------------- Tile pulse helper (re-export) ------------------- */

/**
 * Stateful spring scale that overshoots on each `trigger` change.
 * Wrap the icon tile in `<Animated.View style={tilePulse}>` for a
 * kick-and-settle pulse synced with the card-wide burst.
 *
 *   const tileStyle = useTilePulse(burstAt)
 *   <Animated.View style={tileStyle}>...icon...</Animated.View>
 */
import { useRef } from "react";
export function useTilePulse(trigger: number | string | null) {
  const scale = useSharedValue(1);
  const last = useRef<typeof trigger>(null);

  useEffect(() => {
    if (trigger == null || trigger === last.current) return;
    last.current = trigger;
    scale.value = withSequence(
      withSpring(1.28, { damping: 7, stiffness: 240 }),
      withSpring(1, { damping: 13, stiffness: 180 }),
    );
  }, [trigger, scale]);

  return useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
}
