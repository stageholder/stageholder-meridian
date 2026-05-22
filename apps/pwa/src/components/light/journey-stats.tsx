import { Sparkles, Calendar, Trophy, Zap } from "lucide-react";
import { Text, View, XStack, YStack } from "@stageholder/ui";
import type { UserLight } from "@repo/core/types/light";

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
  ];

  return (
    <View
      display="grid"
      gap="$2"
      style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
    >
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
            <Text shrink={0} lineHeight={0} style={{ color: stat.color }}>
              <Icon size={16} />
            </Text>
            <YStack minW={0}>
              <Text
                fontSize="$3"
                fontWeight="700"
                lineHeight={20}
                color="$color"
                numberOfLines={1}
                style={{ fontVariantNumeric: "tabular-nums" }}
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
    </View>
  );
}
