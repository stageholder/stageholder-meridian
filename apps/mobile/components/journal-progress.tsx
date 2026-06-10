// apps/mobile/components/journal-progress.tsx
//
// Daily word-target progress + target-crossing celebration for the journal
// editors — the NATIVE fill-ins for the shared JournalEditor's
// `renderProgress` / `renderCelebration` render-props. (The PWA fills the
// same slots with its web-only ResizeObserver meridian strip + CSS-keyframe
// confetti; see apps/pwa/src/components/journal/journal-editor.tsx.)
//
// Platform choices, deliberately mobile-idiomatic:
//   - PROGRESS is a slim gold strip + a tabular "187 / 250 words" counter —
//     the same visual language as LevelProgress / the tier-map bar, sized to
//     stay out of the writing surface's way. No pixel-measured chrome.
//   - CELEBRATION goes through the app-root CelebrationProvider (the SAME
//     Reanimated burst as habit completion) in journal golds, with the
//     provider's synced success HAPTIC — the part web can't do. The shared
//     editor guarantees the trigger bumps exactly once per crossing.
//   - While the editor's 2.5s `glow` window is open the strip glows gold,
//     then settles into a quiet "Goal met" state.

import { useEffect, useRef } from "react";
import {
  GradientSurface,
  Text,
  View,
  XStack,
  YStack,
  useCelebrate,
} from "@stageholder/ui";
import type { JournalProgressState } from "@repo/features/journal";

import { IGNITION } from "@/lib/ignition-palette";

/** Journal-gold particle palette (yellow→amber ramp around IGNITION). */
const JOURNAL_GOLDS = ["#facc15", "#fbbf24", "#f59e0b", "#fde68a"];

/** Slim word-target strip above the editor. Hidden when no target is set. */
export function JournalTargetProgress(state: JournalProgressState) {
  const { current, target, percent, met, glow } = state;
  if (target <= 0) return null;

  return (
    <YStack px="$4" pb="$2" gap="$1">
      <View
        height={4}
        width="100%"
        overflow="hidden"
        rounded={9999}
        bg="$muted"
      >
        <GradientSurface
          colors={["#f59e0b", "#facc15"]}
          angle={90}
          height="100%"
          rounded={9999}
          transition="slow"
          width={`${percent}%`}
          // Gold halo during the editor's one-shot glow window.
          boxShadow={glow ? `0 0 10px ${IGNITION.journal.glow}` : undefined}
        />
      </View>
      <XStack justify="flex-end">
        <Text
          fontSize={11}
          color={met ? "#b45309" : "$mutedForeground"}
          fontWeight={met ? "600" : "400"}
          style={{ fontVariant: ["tabular-nums"] as never }}
        >
          {met
            ? `Goal met · ${current.toLocaleString()} words`
            : `${current.toLocaleString()} / ${target.toLocaleString()} words`}
        </Text>
      </XStack>
    </YStack>
  );
}

/**
 * Fires the app-root celebration burst each time the shared editor bumps
 * its crossing counter. Renders nothing — the overlay lives at the root
 * CelebrationProvider (same as the habit completion burst), so it plays
 * above the keyboard and editor chrome.
 */
export function JournalTargetCelebration({ trigger }: { trigger: number }) {
  const celebrate = useCelebrate();
  const prevRef = useRef(trigger);

  useEffect(() => {
    if (trigger > prevRef.current) {
      celebrate({
        // "ember-flame" = the kit's full-screen FIRE treatment (three
        // stacked layers incl. the bottom fire-glow backdrop — see the
        // docs-expo celebration demo), vs "ember-burst" which is just the
        // particle spray habit cards use. Journal golds keep each surface
        // celebrating in its identity hue.
        preset: "ember-flame",
        colors: JOURNAL_GOLDS,
        // "achievement" = the crescendo pattern (light→medium→heavy→success)
        // — hitting the daily writing goal earns the big one.
        haptic: "achievement",
      });
    }
    prevRef.current = trigger;
  }, [trigger, celebrate]);

  return null;
}
