// apps/mobile/components/static-activity-rings.tsx
//
// Non-animated twin of the kit `ActivityRings` for the calendar month grid.
//
// WHY: the kit ProgressRing.native drives every ring's dashoffset with
// Reanimated (shared value + withTiming + animated <Circle>) and has no
// `animated={false}` opt-out yet. The month grid renders rings for every
// past/today cell — ~30-42 cells × 3 rings ≈ 90-126 animated SVG circles all
// spinning up their mount animation at once, a visible open stutter and
// standing UI-thread weight. History cells never change while you look at
// them, so they're drawn here as PLAIN react-native-svg circles with a fixed
// dashoffset — zero Reanimated machinery. Today's cell keeps the kit's
// animated rings (it's the one that moves as you check things off).
//
// Geometry mirrors the kit ActivityRings exactly (concentric: each inner
// ring shrinks by 2×thickness+gap; arc starts at 12 o'clock; rounded caps).

import type { ReactNode } from "react";
import Svg, { Circle } from "react-native-svg";
import { View } from "@stageholder/ui";

interface StaticRing {
  value: number;
  max: number;
  color?: string;
  trackColor?: string;
}

export function StaticActivityRings({
  rings,
  size,
  thickness,
  gap = 4,
  children,
}: {
  rings: StaticRing[];
  size: number;
  thickness: number;
  gap?: number;
  children?: ReactNode;
}) {
  return (
    <View
      width={size}
      height={size}
      items="center"
      justify="center"
      position="relative"
    >
      {rings.map((ring, idx) => {
        const ringSize = size - idx * (thickness * 2 + gap);
        if (ringSize <= 0) return null;
        const offset = (size - ringSize) / 2;
        const r = (ringSize - thickness) / 2;
        const circumference = 2 * Math.PI * r;
        const pct = Math.min(Math.max(ring.value / (ring.max || 100), 0), 1);
        const center = ringSize / 2;
        return (
          <View
            key={idx}
            position="absolute"
            t={offset}
            l={offset}
            width={ringSize}
            height={ringSize}
          >
            <Svg width={ringSize} height={ringSize}>
              <Circle
                cx={center}
                cy={center}
                r={r}
                stroke={ring.trackColor ?? "rgba(128,128,128,0.18)"}
                strokeWidth={thickness}
                fill="none"
              />
              {pct > 0 ? (
                <Circle
                  cx={center}
                  cy={center}
                  r={r}
                  stroke={ring.color ?? "#888"}
                  strokeWidth={thickness}
                  fill="none"
                  strokeDasharray={`${circumference}`}
                  strokeDashoffset={circumference * (1 - pct)}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${center} ${center})`}
                />
              ) : null}
            </Svg>
          </View>
        );
      })}
      {children != null ? (
        <View
          position="absolute"
          t={0}
          l={0}
          width={size}
          height={size}
          items="center"
          justify="center"
        >
          {children}
        </View>
      ) : null}
    </View>
  );
}
