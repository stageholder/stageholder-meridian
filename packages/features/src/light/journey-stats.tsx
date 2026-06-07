import { Sparkles, Calendar, Trophy, Zap } from "@tamagui/lucide-icons-2";
import { Grid, Text, XStack, YStack } from "@stageholder/ui";
import type { UserLight } from "@repo/core/types/light";
import { tabularNums } from "../_internal/text-styles";

interface JourneyStatsProps {
  userLight: UserLight;
}

function getMultiplier(streak: number): number {
  if (streak >= 30) return 3;
  if (streak >= 14) return 2.5;
  if (streak >= 7) return 2;
  if (streak >= 3) return 1.5;
  return 1;
}

export function JourneyStats({ userLight }: JourneyStatsProps) {
  // `color` is the decorative accent for each stat's lucide icon — no kit
  // token, so it rides the style escape hatch.
  const stats = [
    {
      label: "Total Light",
      value: userLight.totalLight.toLocaleString(),
      icon: Sparkles,
      color: "#f59e0b",
    },
    {
      label: "Perfect Days",
      value: String(userLight.perfectDaysTotal),
      icon: Calendar,
      color: "#10b981",
    },
    {
      label: "Longest Streak",
      value: `${userLight.longestPerfectStreak}d`,
      icon: Trophy,
      color: "#3b82f6",
    },
    {
      label: "Multiplier",
      value: `${getMultiplier(userLight.perfectDayStreak)}x`,
      icon: Zap,
      color: "#a855f7",
    },
  ] as const;

  return (
    // Fixed 2-up stat cells — the kit Grid (CSS grid on web, flex-wrap on
    // native) replaces the hand-rolled display:grid + gridTemplateColumns.
    <Grid columns={2} gap="$2">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <XStack
            key={stat.label}
            items="center"
            gap="$2.5"
            rounded="$lg"
            borderWidth={1}
            borderColor="$borderColor"
            bg="$card"
            px="$3"
            py="$2.5"
          >
            {/* lucide-icons-2 reads its own `color` (no CSS cascade); the
                decorative accent hue is a raw hex, not a kit token. */}
            <Icon size={16} shrink={0} color={stat.color} />

            <YStack minW={0}>
              <Text
                fontSize="$3"
                fontWeight="700"
                lineHeight={20}
                color="$color"
                numberOfLines={1}
                style={tabularNums}
              >
                {stat.value}
              </Text>
              <Text fontSize={10} color="$mutedForeground">
                {stat.label}
              </Text>
            </YStack>
          </XStack>
        );
      })}
    </Grid>
  );
}
