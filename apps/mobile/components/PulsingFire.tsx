// apps/mobile/components/PulsingFire.tsx
//
// Center node for ActivityRings — a fire emoji with a slow breathing animation.
// The "light you've earned today" — a small, restrained nod to Meridian's
// gamification metaphor without going Duolingo-loud.
//
// useNativeDriver is on, so the loop runs on the UI thread and survives
// scrolls and gestures without stuttering.

import { useEffect, useRef } from "react";
import { Animated, Text } from "react-native";

export function PulsingFire({ size = 36 }: { size?: number }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.15,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Text style={{ fontSize: size, lineHeight: size + 4 }}>🔥</Text>
    </Animated.View>
  );
}
