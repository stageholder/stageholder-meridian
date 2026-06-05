// src/light/level-up-celebration.native.tsx
//
// NATIVE level-up celebration overlay. The web sibling
// (`level-up-celebration.tsx`) uses `position:"fixed"`, `backdrop-blur-sm`
// (frosted scrim) and `onKeyDown`/`tabIndex` — all web-only — so native gets
// its own full-screen takeover via React Native's <Modal> instead.
//
// Differences from web, by design:
//  - Full-screen presentation: RN <Modal transparent statusBarTranslucent
//    animationType="fade"> rather than a fixed-position View + z-index.
//  - No backdrop blur on native (no cross-platform blur primitive without an
//    extra dep), so the scrim opacity is bumped to 0.75 to compensate for the
//    missing frost.
//  - No keyboard dismiss (no hardware keyboard focus on phones); tap-anywhere
//    dismiss is preserved via the pressable scrim.
//
// Everything else matches the web file: same `{ tier, onDismiss }` contract,
// the identical 4000ms auto-dismiss timer, the centered StarVisual + the same
// two texts. `StarVisual` here resolves to `star-visual.native.tsx` via the
// platform-suffix split (relative import → Metro substitution).

import { useEffect } from "react";
import { Modal } from "react-native";
import { Text, View, YStack } from "@stageholder/ui";
import { StarVisual } from "./star-visual";
import { LIGHT_TIERS } from "@repo/core/types/light";

interface LevelUpCelebrationProps {
  tier: number;
  onDismiss: () => void;
}

export function LevelUpCelebration({
  tier,
  onDismiss,
}: LevelUpCelebrationProps) {
  const tierInfo = LIGHT_TIERS[tier - 1];
  const tierTitle = tierInfo?.title ?? "Unknown";

  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <Modal
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      {/* Pressable dark scrim — tap anywhere to dismiss. No blur on native, so
          the scrim is darker (0.75) than the web 0.6 to compensate. The scrim
          is intentionally theme-independent, so the color is a raw rgba. */}
      <View
        flex={1}
        items="center"
        justify="center"
        onPress={onDismiss}
        style={{ backgroundColor: "rgba(0, 0, 0, 0.75)" }}
      >
        <YStack items="center" gap="$6">
          <StarVisual tier={tier} size="xl" animate />
          <YStack gap="$2" items="center">
            {/* White-on-scrim text is intentionally theme-independent — no
                token, so the color rides the style escape hatch. */}
            <Text
              fontSize="$8"
              fontWeight="700"
              text="center"
              style={{ color: "#ffffff" }}
            >
              You&apos;ve become a {tierTitle}
            </Text>
            <Text
              fontSize="$3"
              text="center"
              style={{ color: "rgba(255, 255, 255, 0.6)" }}
            >
              Tap to dismiss
            </Text>
          </YStack>
        </YStack>
      </View>
    </Modal>
  );
}
