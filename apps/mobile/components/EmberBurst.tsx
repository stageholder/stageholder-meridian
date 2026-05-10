// apps/mobile/components/EmberBurst.tsx
//
// Particle burst for completion moments. Eight tiny dots fly out radially
// from a center point while fading — the visual reward for finishing a
// todo or checking in a habit. Cheap (Animated, native driver) so it
// composes with normal scroll/gesture flow without stutter.
//
//   <EmberBurst trigger={burstAt} color="#a855f7" />
//
// `trigger` is any value that changes when you want a new burst — the
// component watches it via useEffect and runs the animation each time the
// reference flips. Pass `Date.now()` from a tap handler to fire one.

import { useEffect, useMemo, useRef } from "react";
import { Animated, View } from "react-native";

const PARTICLE_COUNT = 8;
const PARTICLE_SIZE = 6;
const TRAVEL = 36; // px outward from origin
const DURATION = 600; // ms

export type EmberBurstProps = {
  /** Any value that changes triggers a new burst. */
  trigger: number | string | null;
  /** Particle color. Use the brand step or the habit color for context. */
  color?: string;
  /** Center x/y offset within the parent. Defaults to 0/0 (parent's origin). */
  x?: number;
  y?: number;
  /** Hide entirely (e.g. low-power mode). */
  disabled?: boolean;
};

export function EmberBurst({
  trigger,
  color = "#f59e0b",
  x = 0,
  y = 0,
  disabled,
}: EmberBurstProps) {
  // One Animated.Value per particle, kept stable across renders.
  const progress = useRef(
    Array.from({ length: PARTICLE_COUNT }, () => new Animated.Value(0)),
  ).current;

  const angles = useMemo(
    () =>
      Array.from(
        { length: PARTICLE_COUNT },
        (_, i) => (i / PARTICLE_COUNT) * Math.PI * 2,
      ),
    [],
  );

  useEffect(() => {
    if (disabled || trigger == null) return;
    // Reset, then run.
    progress.forEach((v) => v.setValue(0));
    Animated.parallel(
      progress.map((v) =>
        Animated.timing(v, {
          toValue: 1,
          duration: DURATION,
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [trigger, disabled, progress]);

  if (disabled) return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 0,
        height: 0,
        // The 0×0 size + visible-overflow children gives us a positioning
        // origin without consuming layout space.
      }}
    >
      {progress.map((v, i) => {
        const a = angles[i]!;
        const tx = v.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.cos(a) * TRAVEL],
        });
        const ty = v.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.sin(a) * TRAVEL],
        });
        const opacity = v.interpolate({
          inputRange: [0, 0.2, 1],
          outputRange: [0, 1, 0],
        });
        const scale = v.interpolate({
          inputRange: [0, 0.4, 1],
          outputRange: [0.5, 1.2, 0.6],
        });
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              width: PARTICLE_SIZE,
              height: PARTICLE_SIZE,
              borderRadius: PARTICLE_SIZE / 2,
              backgroundColor: color,
              transform: [{ translateX: tx }, { translateY: ty }, { scale }],
              opacity,
            }}
          />
        );
      })}
    </View>
  );
}
