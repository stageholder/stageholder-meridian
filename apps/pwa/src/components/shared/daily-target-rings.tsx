import { format } from "date-fns";
import { CheckSquare, BookOpen, Target } from "lucide-react";
import { useActivityRings } from "@/lib/hooks/use-activity-rings";
import {
  Popover,
  ProgressRing,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";

export function DailyTargetRings() {
  const today = format(new Date(), "yyyy-MM-dd");
  const { data, details, isLoading } = useActivityRings(today);

  if (isLoading) return null;

  const rows = [
    {
      key: "todo",
      Icon: CheckSquare,
      ring: "var(--ring-todo)",
      track: "var(--ring-todo-track)",
      label: "Todos",
      percent: data.todo,
      subtitle: `${details.todoDone}/${details.todoTarget} completed`,
    },
    {
      key: "habit",
      Icon: Target,
      ring: "var(--ring-habit)",
      track: "var(--ring-habit-track)",
      label: "Habits",
      percent: data.habit,
      subtitle: `${details.habitDone}/${details.habitTotal} completed`,
    },
    {
      key: "journal",
      Icon: BookOpen,
      ring: "var(--ring-journal)",
      track: "var(--ring-journal-track)",
      label: "Journal",
      percent: data.journal,
      subtitle: `${details.journalWords}/${details.journalTarget} words`,
    },
  ] as const;

  return (
    <Popover placement="bottom-end">
      <Popover.Trigger asChild>
        <XStack
          items="center"
          gap={4}
          rounded="$md"
          px="$1"
          py="$1"
          cursor="pointer"
          transition="quick"
          hoverStyle={{ bg: "$accent" }}
          aria-label="View daily targets"
        >
          {rows.map((r) => {
            const Icon = r.Icon;
            const complete = r.percent >= 100;
            return (
              <ProgressRing
                key={r.key}
                value={r.percent}
                size={28}
                thickness={2.5}
                fillColor={r.ring}
                trackColor={r.track}
              >
                {/* Tamagui `color` flows to the icon via currentColor. */}
                <View color={(complete ? r.ring : "$mutedForeground") as never}>
                  <Icon size={14} />
                </View>
              </ProgressRing>
            );
          })}
        </XStack>
      </Popover.Trigger>
      <Popover.Content width={236} p="$3" items="stretch">
        <Text
          mb="$2.5"
          width="100%"
          fontSize={11}
          fontWeight="700"
          letterSpacing={0.6}
          textTransform="uppercase"
          color="$mutedForeground"
        >
          Daily Targets
        </Text>
        <YStack width="100%" gap="$2.5">
          {rows.map((r) => {
            const Icon = r.Icon;
            const complete = r.percent >= 100;
            return (
              <XStack key={r.key} width="100%" items="center" gap="$2.5">
                <ProgressRing
                  value={r.percent}
                  size={34}
                  thickness={3}
                  fillColor={r.ring}
                  trackColor={r.track}
                >
                  <View
                    color={(complete ? r.ring : "$mutedForeground") as never}
                  >
                    <Icon size={16} />
                  </View>
                </ProgressRing>
                {/* Title + % share one baseline so the figure reads as the
                    row's value instead of floating in the vertical gap. */}
                <YStack flex={1} minW={0} gap={1}>
                  <XStack items="center" justify="space-between" gap="$2">
                    <Text fontSize="$2" fontWeight="600" color="$color">
                      {r.label}
                    </Text>
                    <Text
                      fontSize="$2"
                      fontWeight="700"
                      color={(complete ? r.ring : "$color") as never}
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {Math.round(r.percent)}%
                    </Text>
                  </XStack>
                  <Text
                    fontSize={12}
                    color="$mutedForeground"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {r.subtitle}
                  </Text>
                </YStack>
              </XStack>
            );
          })}
        </YStack>
      </Popover.Content>
    </Popover>
  );
}
