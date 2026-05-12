// apps/mobile/components/todos/RowFireSweep.tsx
//
// Single-color filling wave. Renders one colored layer the full clip
// width and slides it in from the left with translateX from `-distance`
// to `0`. Opacity ramps 0 → peak → 0 so the wave breathes in and out
// rather than committing to a hold-then-snap-off finish.
//
// We deliberately use ONE layer (vs. the earlier base + accent core +
// leading edge): the multi-layer version read as two separate flames
// racing each other instead of a unified ignition. One color, animated
// opacity, much cleaner.
//
// Native-drivable: translateX + opacity. The sweep stays smooth even
// while React is reconciling the LayoutAnimation settle that fires
// right after.

import { useEffect, useRef, useState } from "react";
import { Animated, Easing, type LayoutChangeEvent, View } from "react-native";

const SWEEP_DURATION_MS = 700;
const PEAK_INPUT = 0.34;
const PEAK_OPACITY = 0.55;

export type RowFireSweepProps = {
  /** Any value that changes triggers a new sweep. Pass Date.now(). */
  trigger: number | string | null;
  /** Starting x within the row. Default 0 (very left edge of the row). */
  originX?: number;
  /** Fire color for the wave. Defaults to orange-500. */
  color?: string;
};

export function RowFireSweep({
  trigger,
  originX = 0,
  color = "#f97316",
}: RowFireSweepProps) {
  const [rowWidth, setRowWidth] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (trigger == null || rowWidth === 0) return;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: SWEEP_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [trigger, rowWidth, progress]);

  const distance = Math.max(0, rowWidth - originX);

  // translateX: -distance (off left) → 0 (fully filling the clip).
  const tx = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-distance, 0],
  });
  // Opacity rises faster than it falls — the wave "bursts in" then
  // gently dissipates, like a flame consuming fuel.
  const opacity = progress.interpolate({
    inputRange: [0, PEAK_INPUT, 1],
    outputRange: [0, PEAK_OPACITY, 0],
  });

  function handleLayout(e: LayoutChangeEvent) {
    const w = e.nativeEvent.layout.width;
    if (w !== rowWidth) setRowWidth(w);
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
      {distance > 0 ? (
        <View
          style={{
            position: "absolute",
            left: originX,
            top: 0,
            bottom: 0,
            width: distance,
            overflow: "hidden",
          }}
        >
          <Animated.View
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: distance,
              backgroundColor: color,
              opacity,
              transform: [{ translateX: tx }],
            }}
          />
        </View>
      ) : null}
    </View>
  );
}
