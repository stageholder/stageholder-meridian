// apps/mobile/components/todos/CheckboxFlame.tsx
//
// A small flickering flame that sits inside the todo checkbox during the
// celebration window. Three stacked layers — outer glow, body, inner core —
// each animated with a phase-offset wobble so the flame "dances".
//
// Why View layers instead of an SVG flame: react-native-svg adds a Yoga
// layout pass per render which jitters under tight loops. Layered Views
// with native-driver transforms stay smooth even on older Android.
//
// Driven by a single Animated.Value that loops 0→1 over ~360ms. Each
// layer reads it through its own interpolate() so they breathe at
// different rates and the flame never looks mechanical.

import { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";

const LOOP_MS = 360;

export type CheckboxFlameProps = {
  /** When false the flame fades to invisible (and the loop pauses). */
  active: boolean;
  /** Container size — the flame scales to fit. Default 26 (CheckCircle size). */
  size?: number;
};

export function CheckboxFlame({ active, size = 26 }: CheckboxFlameProps) {
  // One looping clock; every layer reads it with its own phase offset so
  // the wobble isn't synchronized (which would look mechanical).
  const t = useRef(new Animated.Value(0)).current;

  // Master opacity — drives the in/out fade tied to `active`. Separate from
  // the loop clock so we can fade out cleanly without disrupting flicker.
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (active) {
      // Fade in fast.
      Animated.timing(opacity, {
        toValue: 1,
        duration: 90,
        useNativeDriver: true,
      }).start();
      // Start (or keep) the looping clock.
      t.setValue(0);
      const loop = Animated.loop(
        Animated.timing(t, {
          toValue: 1,
          duration: LOOP_MS,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      loop.start();
      return () => loop.stop();
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start();
      return;
    }
  }, [active, t, opacity]);

  // The flame body is a vertical-stretched rounded shape. Each layer is
  // smaller and brighter as you move inward — outer glow → body → core.
  // Vertical scale modulates with the wobble so the flame "licks upward".
  const renderLayer = (
    layer: "glow" | "body" | "core",
    phaseOffset: number,
  ) => {
    const baseW =
      layer === "glow"
        ? size * 0.72
        : layer === "body"
          ? size * 0.46
          : size * 0.22;
    const baseH =
      layer === "glow"
        ? size * 0.95
        : layer === "body"
          ? size * 0.7
          : size * 0.42;
    const color =
      layer === "glow"
        ? "rgba(249,115,22,0.55)" // orange-500 @ 55%
        : layer === "body"
          ? "#fbbf24" // amber-400
          : "#fffbeb"; // amber-50 (near-white hot core)

    // Each layer flickers on a slightly different cycle by reading the
    // clock through its own offset. The outer glow breathes slow + wide;
    // the inner core jitters fast + narrow.
    const phase = Animated.modulo(Animated.add(t, phaseOffset), 1);
    const scaleY = phase.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange:
        layer === "core"
          ? [0.85, 1.18, 0.85]
          : layer === "body"
            ? [0.92, 1.12, 0.92]
            : [0.96, 1.08, 0.96],
    });
    const translateY = phase.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange:
        layer === "core"
          ? [-1, -3, -1]
          : layer === "body"
            ? [-0.5, -2, -0.5]
            : [0, -1, 0],
    });
    const translateX = phase.interpolate({
      inputRange: [0, 0.25, 0.5, 0.75, 1],
      outputRange: layer === "core" ? [0, 1, 0, -1, 0] : [0, 0.5, 0, -0.5, 0],
    });

    return (
      <Animated.View
        key={layer}
        pointerEvents="none"
        style={{
          position: "absolute",
          width: baseW,
          height: baseH,
          // Pin to bottom-center of the box — flames have a base.
          left: (size - baseW) / 2,
          bottom: 2,
          // Rounded top, tapered base — a candle-flame silhouette.
          borderTopLeftRadius: baseW,
          borderTopRightRadius: baseW,
          borderBottomLeftRadius: baseW * 0.3,
          borderBottomRightRadius: baseW * 0.3,
          backgroundColor: color,
          transform: [{ translateX }, { translateY }, { scaleY }],
        }}
      />
    );
  };

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: size,
        height: size,
        left: 0,
        top: 0,
        opacity,
      }}
    >
      {renderLayer("glow", 0)}
      {renderLayer("body", 0.27)}
      {renderLayer("core", 0.54)}
    </Animated.View>
  );
}
