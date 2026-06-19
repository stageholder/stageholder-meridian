import { Link } from "@tanstack/react-router";
import { Text, View, XStack, YStack } from "@stageholder/ui";
import type { UserLight } from "@repo/core/types/light";
import { LevelProgress } from "@repo/features/light";
import { BentoCard } from "@repo/features/dashboard";
import { ActivityRings } from "@/components/activity-rings";
import { useActivityRings } from "@/lib/hooks/use-activity-rings";

const TABULAR = { fontVariantNumeric: "tabular-nums" } as const;

interface DashboardHeroProps {
  date: string;
  userLight?: UserLight;
}

/**
 * The dashboard's motivation centerpiece — one full-width card that merges
 * what used to be two stacked cards (combined rings + level, and the
 * per-category breakdown). Because it spans the full width it never gets
 * stretched against a taller neighbor, which is what left dead space under
 * the old left column.
 *
 * Layout: the XL activity rings sit beside the Light/level progress + a
 * compact Todos/Habits/Journal stat strip from $md up, and stack on phones.
 * The whole card links to /journey (the analytics/progress home).
 *
 * Data: `useActivityRings(date)` is the same cached query the inner
 * `<ActivityRings>` reads, so driving the stat strip from it is free.
 */
export function DashboardHero({ date, userLight }: DashboardHeroProps) {
  const { data, details } = useActivityRings(date);

  const stats = [
    {
      label: "Todos",
      value: `${details.todoDone}/${details.todoTarget}`,
      pct: Math.round(data.todo),
    },
    {
      label: "Habits",
      value: `${details.habitDone}/${details.habitTotal}`,
      pct: Math.round(data.habit),
    },
    {
      label: "Journal",
      value: `${details.journalWords}/${details.journalTarget}`,
      pct: Math.round(data.journal),
    },
  ];

  return (
    <BentoCard index={1}>
      <Link to="/journey" style={{ display: "block", textDecoration: "none" }}>
        {/* Rings centered above on phones; beside the level + stats from $md. */}
        <YStack gap="$5" $md={{ flexDirection: "row", items: "center" }}>
          <XStack justify="center" shrink={0} $md={{ justify: "flex-start" }}>
            <ActivityRings date={date} size="xl" bare />
          </XStack>

          <YStack flex={1} minW={0} width="100%" gap="$5">
            {userLight ? <LevelProgress userLight={userLight} /> : null}

            {/* Compact per-category breakdown — value-forward, no extra rings
                (the hero already has the combined rings). Divided into three
                equal tiles with hairline separators. */}
            <XStack
              borderTopWidth={1}
              borderColor="$borderColor"
              pt="$4"
              gap="$3"
            >
              {stats.map((s, i) => (
                <YStack
                  key={s.label}
                  flex={1}
                  minW={0}
                  gap="$0.5"
                  borderLeftWidth={i === 0 ? 0 : 1}
                  borderColor="$borderColor"
                  pl={i === 0 ? 0 : "$3"}
                >
                  <Text
                    fontSize="$1"
                    color="$mutedForeground"
                    textTransform="uppercase"
                    letterSpacing={0.6}
                  >
                    {s.label}
                  </Text>
                  <Text
                    fontSize="$6"
                    fontWeight="700"
                    color="$color"
                    numberOfLines={1}
                    style={TABULAR}
                  >
                    {s.value}
                  </Text>
                  <Text fontSize="$1" color="$mutedForeground" style={TABULAR}>
                    {s.pct}%
                  </Text>
                </YStack>
              ))}
            </XStack>
          </YStack>
        </YStack>
      </Link>
    </BentoCard>
  );
}
