import {
  Flame,
  CheckCircle2,
  Repeat2,
  BookOpen,
} from "@tamagui/lucide-icons-2";
import { ProgressRing, Text, XStack, YStack } from "@stageholder/ui";
import type { UserLight } from "@repo/core/types/light";
import { tabularNums } from "../_internal/text-styles";

interface JourneyStreaksProps {
  userLight: UserLight;
}

// `color` is the decorative accent for both the ProgressRing fill and the
// centered lucide icon (no kit token — raw hex). `track` is the same hue at
// ~15% opacity for the ring's unfilled arc (rgba so it resolves on web AND
// native, matching the old Tailwind `stroke-*-500/15` classes).
const streakCards = [
  {
    label: "Perfect Day",
    icon: Flame,
    color: "#f59e0b",
    track: "rgba(245, 158, 11, 0.15)",
    currentKey: "perfectDayStreak" as const,
    bestKey: "longestPerfectStreak" as const,
    maxDays: 30,
  },
  {
    label: "Todos",
    icon: CheckCircle2,
    color: "#3b82f6",
    track: "rgba(59, 130, 246, 0.15)",
    currentKey: "todoRingStreak" as const,
    bestKey: null,
    maxDays: 14,
  },
  {
    label: "Habits",
    icon: Repeat2,
    color: "#f97316",
    track: "rgba(249, 115, 22, 0.15)",
    currentKey: "habitRingStreak" as const,
    bestKey: null,
    maxDays: 14,
  },
  {
    label: "Journal",
    icon: BookOpen,
    color: "#10b981",
    track: "rgba(16, 185, 129, 0.15)",
    currentKey: "journalRingStreak" as const,
    bestKey: null,
    maxDays: 14,
  },
] as const;

export function JourneyStreaks({ userLight }: JourneyStreaksProps) {
  return (
    // Flexbox auto-fit: cards flex to fill, wrapping below minWidth so the row
    // reads ~2 cols on narrow screens and ~4 once wide enough (gap-3 → $3).
    <XStack flexWrap="wrap" gap="$3">
      {streakCards.map((card) => {
        const Icon = card.icon;
        const current = userLight[card.currentKey];
        const best = card.bestKey ? userLight[card.bestKey] : null;

        return (
          <XStack
            key={card.label}
            flex={1}
            minW={150}
            items="center"
            gap="$3"
            rounded="$lg"
            borderWidth={1}
            borderColor="$borderColor"
            bg="$card"
            p="$3"
          >
            {/* Kit ProgressRing replaces the hand-rolled <svg><circle/></svg>
                — cross-platform (HTML SVG on web, react-native-svg on native).
                The accent icon sits in the ring's centered children slot. */}
            <ProgressRing
              value={current}
              max={card.maxDays}
              size={52}
              thickness={4}
              fillColor={card.color}
              trackColor={card.track}
            >
              {/* lucide-icons-2 reads its own `color` (no CSS cascade). */}
              <Icon size={16} color={card.color} />
            </ProgressRing>
            <YStack minW={0}>
              <Text
                fontSize="$6"
                fontWeight="700"
                lineHeight={20}
                color="$color"
                style={tabularNums}
              >
                {current}d
              </Text>
              <Text fontSize="$1" color="$mutedForeground">
                {card.label}
              </Text>
              {best !== null && (
                <Text fontSize={10} color="$mutedForeground">
                  Best: {best}d
                </Text>
              )}
            </YStack>
          </XStack>
        );
      })}
    </XStack>
  );
}
