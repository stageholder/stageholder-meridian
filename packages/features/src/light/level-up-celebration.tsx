import { useEffect } from "react";
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
    // WEB-TRUTH file. Native gets a separate full-screen <Modal> takeover —
    // see `level-up-celebration.native.tsx` (Metro resolves that sibling, so
    // the web-only bits below — position:fixed, backdrop-blur, onKeyDown,
    // tabIndex — never ship to native).
    //
    // Mount fade converted to native enter animation (animate-in fade-in
    // duration-300 → enterStyle opacity + transition="medium"). The dark
    // scrim (bg-black/60) has no token (intentionally theme-independent), so
    // it rides the style hatch; backdrop-blur-sm is kept as an allowlist class
    // (frosted glass, no token equivalent). position:fixed is web-only and
    // omitted from Tamagui's type, so it's cast `as never` (see kit Header).
    <View
      position={"fixed" as never}
      t={0}
      r={0}
      b={0}
      l={0}
      z={50}
      cursor="pointer"
      items="center"
      justify="center"
      enterStyle={{ opacity: 0 }}
      transition="medium"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
      // allowlist: backdrop-blur-sm — frosted scrim, no token equivalent
      className="backdrop-blur-sm"
      role="button"
      tabIndex={0}
      onPress={onDismiss}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onDismiss();
      }}
    >
      <YStack items="center" gap="$6">
        <StarVisual tier={tier} size="xl" animate />
        <YStack gap="$2" items="center">
          {/* White-on-scrim text is intentionally theme-independent — no token,
              so the color rides the style escape hatch. */}
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
  );
}
