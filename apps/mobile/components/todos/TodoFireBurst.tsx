// apps/mobile/components/todos/TodoFireBurst.tsx
//
// Mobile-tuned completion celebration. Two-layer fire animation:
//
//   1. RING SHIMMER — a hot-color halo briefly blooms around the checkbox
//      then fades. Sets the emotional beat — "you lit this one".
//   2. PARTICLES    — 14 embers fly outward, larger and warmer than the
//      cross-platform EmberBurst. Sizes vary so the spread feels
//      organic rather than mathematical.
//
// Total duration ~750ms. Uses RN's Animated API on the native driver so
// it composes with scroll/gesture without dropping frames.
//
// Why a separate component from EmberBurst:
//   - EmberBurst is the cross-platform primitive in @stageholder/ui-style
//     for any "small ack" moment (habit check-in, button press).
//   - TodoFireBurst is the LOUD moment specific to todos — bigger, more
//     particles, mobile-specific tuning. Keeps the generic one small.

import { useEffect, useMemo, useRef } from "react";
import { Animated, View } from "react-native";

const PARTICLE_COUNT = 14;
const DURATION_MS = 750;
const RING_DURATION_MS = 450;

// Slightly randomized per-particle travel + size so the burst feels alive.
// Computed once per mount, not per render.
function buildParticles(): {
  angle: number;
  travel: number;
  size: number;
  delay: number;
}[] {
  const arr = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
    // ±25% jitter on the radial distance so the cloud isn't a perfect ring.
    const travel = 40 + (Math.sin(i * 7.3) * 0.5 + 0.5) * 18;
    const size = 4 + ((i * 11) % 5);
    const delay = (i % 4) * 18;
    arr.push({ angle, travel, size, delay });
  }
  return arr;
}

export type TodoFireBurstProps = {
  /** Any value that changes triggers a new burst. Pass Date.now() on tap. */
  trigger: number | string | null;
  /** Origin within the parent (the checkbox center). */
  x?: number;
  y?: number;
  /** Hot color for the leading particles + ring. Defaults to amber. */
  color?: string;
  /** Warmer accent color for the trailing particles. Defaults to red-orange. */
  accent?: string;
};

export function TodoFireBurst({
  trigger,
  x = 0,
  y = 0,
  color = "#fbbf24", // amber-400
  accent = "#ef4444", // red-500
}: TodoFireBurstProps) {
  const particles = useMemo(buildParticles, []);

  // One pair of Animated.Values per particle (translate progress) + one
  // global value for the ring shimmer.
  const progress = useRef(particles.map(() => new Animated.Value(0))).current;
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (trigger == null) return;

    // Reset values, then start.
    progress.forEach((v) => v.setValue(0));
    ring.setValue(0);

    Animated.parallel([
      // Ring: fast in, slower fade out.
      Animated.timing(ring, {
        toValue: 1,
        duration: RING_DURATION_MS,
        useNativeDriver: true,
      }),
      // Particles: parallel with staggered start.
      Animated.stagger(
        20,
        progress.map((v) =>
          Animated.timing(v, {
            toValue: 1,
            duration: DURATION_MS,
            useNativeDriver: true,
          }),
        ),
      ),
    ]).start();
  }, [trigger, progress, ring]);

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 0,
        height: 0,
      }}
    >
      {/* RING — a hot halo that blooms then fades. */}
      <Animated.View
        style={{
          position: "absolute",
          width: 48,
          height: 48,
          marginLeft: -24,
          marginTop: -24,
          borderRadius: 24,
          borderWidth: 3,
          borderColor: color,
          opacity: ring.interpolate({
            inputRange: [0, 0.2, 1],
            outputRange: [0, 0.85, 0],
          }),
          transform: [
            {
              scale: ring.interpolate({
                inputRange: [0, 1],
                outputRange: [0.4, 1.8],
              }),
            },
          ],
        }}
      />

      {/* PARTICLES — embers fly outward with subtle vertical lift. */}
      {progress.map((v, i) => {
        const p = particles[i]!;
        // Half the particles use the warmer accent so the cloud has
        // visual variation, like real embers.
        const dotColor = i % 2 === 0 ? color : accent;
        const tx = v.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.cos(p.angle) * p.travel],
        });
        // Add a slight upward bias to half the particles — fire rises.
        const ty = v.interpolate({
          inputRange: [0, 1],
          outputRange: [
            0,
            Math.sin(p.angle) * p.travel - (i % 3 === 0 ? 8 : 0),
          ],
        });
        const opacity = v.interpolate({
          inputRange: [0, 0.15, 0.7, 1],
          outputRange: [0, 1, 0.7, 0],
        });
        const scale = v.interpolate({
          inputRange: [0, 0.3, 1],
          outputRange: [0.4, 1.2, 0.5],
        });
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              width: p.size,
              height: p.size,
              marginLeft: -p.size / 2,
              marginTop: -p.size / 2,
              borderRadius: p.size / 2,
              backgroundColor: dotColor,
              transform: [{ translateX: tx }, { translateY: ty }, { scale }],
              opacity,
            }}
          />
        );
      })}
    </View>
  );
}
