import { CheckSquare, Target, BookOpen } from "lucide-react";
import { Text, View, XStack, YStack } from "@stageholder/ui";
import { useActivityRings } from "@/lib/hooks/use-activity-rings";
import { ActivityRingsVisual, RING_COLORS } from "./activity-rings-visual";
import type { ActivityRingsSize } from "./activity-rings-visual";

interface ActivityRingsProps {
  date: string;
  size?: ActivityRingsSize;
  showLabels?: boolean;
  bare?: boolean;
  className?: string;
}

const CATEGORIES = [
  {
    key: "todo" as const,
    label: "Todos",
    color: RING_COLORS.todo.color,
    icon: CheckSquare,
  },
  {
    key: "habit" as const,
    label: "Habits",
    color: RING_COLORS.habit.color,
    icon: Target,
  },
  {
    key: "journal" as const,
    label: "Journal",
    color: RING_COLORS.journal.color,
    icon: BookOpen,
  },
] as const;

export function ActivityRings({
  date,
  size = "xl",
  showLabels,
  bare,
  className,
}: ActivityRingsProps) {
  const { data, isLoading, details } = useActivityRings(date);

  if (isLoading) {
    return (
      <View
        items="center"
        justify="center"
        minH={size === "xl" ? 160 : 96}
        className={className}
      >
        {/* allowlist: animate-spin — continuous loading spinner keyframe (no token equivalent) */}
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary" />
      </View>
    );
  }

  if (!showLabels) {
    return (
      <ActivityRingsVisual data={data} size={size} className={className} />
    );
  }

  const fractions: Record<string, string> = {
    todo: `${details.todoDone}/${details.todoTarget}`,
    habit: `${details.habitDone}/${details.habitTotal}`,
    journal: `${details.journalWords}/${details.journalTarget} words`,
  };

  const percentages: Record<string, number> = {
    todo: Math.round(data.todo),
    habit: Math.round(data.habit),
    journal: Math.round(data.journal),
  };

  return (
    <View
      className={className}
      rounded={bare ? undefined : "$lg"}
      borderWidth={bare ? undefined : 1}
      borderColor={bare ? undefined : "$borderColor"}
      bg={bare ? undefined : "$card"}
      p={bare ? undefined : "$5"}
    >
      {/* Column on mobile, row at sm (Tailwind flex-col sm:flex-row). */}
      <YStack items="center" gap="$5" $sm={{ flexDirection: "row" }}>
        <ActivityRingsVisual data={data} size={size} />
        <YStack minW={0} flex={1} gap="$3">
          {CATEGORIES.map(({ key, label, color, icon: Icon }) => (
            <XStack key={key} items="center" gap="$3">
              {/* Ring colors are viz CSS vars (var(--ring-*)) — kept via the
                  style hatch so the legend icon matches the SVG stroke. */}
              <Text shrink={0} lineHeight={0} style={{ color }}>
                <Icon size={16} />
              </Text>
              <YStack minW={0} flex={1}>
                <Text fontSize="$3" fontWeight="500" color="$color">
                  {label}
                </Text>
                <Text
                  fontSize="$1"
                  color="$mutedForeground"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {fractions[key]} · {percentages[key]}%
                </Text>
              </YStack>
            </XStack>
          ))}
        </YStack>
      </YStack>
    </View>
  );
}
