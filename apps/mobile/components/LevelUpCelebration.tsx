// apps/mobile/components/LevelUpCelebration.tsx
//
// Full-screen overlay that fires when the user's light tier ticks up.
// Mirrors the PWA's LevelUpCelebration intent — a brief celebratory
// "you've leveled up" moment that gets out of the way fast.
//
// Detection lives in the parent: it watches currentTier and renders this
// with the new tier when it crosses up. The overlay auto-dismisses after
// CELEBRATION_DURATION_MS unless the user taps to dismiss sooner.

import { Paragraph, Text, View, YStack, useHaptic } from "@stageholder/ui";
import type { LightTier } from "@repo/core/types";
import { useEffect } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet } from "react-native";

import { PulsingFire } from "./PulsingFire";

const CELEBRATION_DURATION_MS = 4200;

export type LevelUpCelebrationProps = {
  open: boolean;
  tier: LightTier;
  onClose: () => void;
};

export function LevelUpCelebration({
  open,
  tier,
  onClose,
}: LevelUpCelebrationProps) {
  const haptic = useHaptic();

  // Drive the entry animation manually so it stays small + composable
  // (no extra library dep). Two parallel tweens: fade-in + scale-up.
  const opacity = new Animated.Value(0);
  const scale = new Animated.Value(0.7);

  useEffect(() => {
    if (!open) return;
    haptic.notification("success");
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        damping: 11,
        useNativeDriver: true,
      }),
    ]).start();

    const t = setTimeout(onClose, CELEBRATION_DURATION_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Modal
      visible={open}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View
          style={[styles.card, { opacity, transform: [{ scale }] }]}
        >
          <YStack gap="$4" items="center">
            <View width={120} height={120} items="center" justify="center">
              <PulsingFire size={88} />
            </View>
            <YStack gap="$1" items="center">
              <Text
                fontFamily="$mono"
                fontSize={11}
                letterSpacing={3}
                textTransform="uppercase"
                color="$color11"
                fontWeight="600"
              >
                Tier {tier.tier} unlocked
              </Text>
              <Text
                fontSize="$8"
                fontWeight="700"
                color="$color12"
                letterSpacing={1.2 as never}
              >
                {tier.title}
              </Text>
            </YStack>
            <Paragraph
              fontSize="$2"
              color="$color11"
              text="center"
              lineHeight="$2"
              maxWidth={280}
            >
              {tier.shortDescription}
            </Paragraph>
            <Text fontSize="$1" color="$color10">
              Tap to dismiss
            </Text>
          </YStack>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.78)",
    paddingHorizontal: 24,
  },
  card: {
    paddingVertical: 36,
    paddingHorizontal: 28,
    borderRadius: 24,
    backgroundColor: "rgba(20,20,30,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    minWidth: 280,
  },
});
