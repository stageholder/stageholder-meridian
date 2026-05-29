import { CheckSquare, Target, BookOpen } from "lucide-react";
import {
  ActivityRings as KitActivityRings,
  Skeleton,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import {
  activityRingsConfig,
  RING_CATEGORY,
  type ActivityRingsData,
  type ActivityRingsDetails,
} from "./config";

export type ActivityRingsSize = "xs" | "sm" | "md" | "lg" | "xl";

/**
 * Named size presets → kit `<ActivityRings>` dimensions in pixels.
 * `thickness` / `gap` are tuned per size so the innermost (todo) ring
 * never collapses at small sizes.
 */
const SIZE_PX: Record<
  ActivityRingsSize,
  { size: number; thickness: number; gap: number }
> = {
  xs: { size: 24, thickness: 3, gap: 1.5 },
  sm: { size: 32, thickness: 4, gap: 2 },
  md: { size: 48, thickness: 5, gap: 3 },
  lg: { size: 96, thickness: 9, gap: 4 },
  xl: { size: 160, thickness: 13, gap: 5 },
};

const CATEGORIES = [
  {
    key: "todo" as const,
    label: "Todos",
    color: RING_CATEGORY.todo.color,
    icon: CheckSquare,
  },
  {
    key: "habit" as const,
    label: "Habits",
    color: RING_CATEGORY.habit.color,
    icon: Target,
  },
  {
    key: "journal" as const,
    label: "Journal",
    color: RING_CATEGORY.journal.color,
    icon: BookOpen,
  },
] as const;

export interface ActivityRingsProps {
  data: ActivityRingsData;
  details: ActivityRingsDetails;
  isLoading?: boolean;
  size?: ActivityRingsSize;
  showLabels?: boolean;
  bare?: boolean;
  className?: string;
}

/**
 * Cross-platform activity-rings view. Presentational only — takes the
 * pre-computed per-day percentages (`data`) + granular fractions
 * (`details`) and renders the kit `<ActivityRings>` visual, optionally
 * with a category legend.
 *
 * The host's hook (`useActivityRings(date)` on web, the mobile
 * equivalent) computes `data`/`details`/`isLoading` from its
 * platform-specific data sources and feeds them in.
 *
 * Loading state uses the kit `Skeleton` (cross-platform) — no web-only
 * spinner, so the view runs identically on both runtimes without a
 * `.native.tsx` companion.
 */
export function ActivityRings({
  data,
  details,
  isLoading,
  size = "xl",
  showLabels,
  bare,
  className,
}: ActivityRingsProps) {
  const dims = SIZE_PX[size];

  if (isLoading) {
    return (
      <View
        items="center"
        justify="center"
        minH={size === "xl" ? 160 : 96}
        className={className}
      >
        <Skeleton height={dims.size} width={dims.size} rounded={9999} />
      </View>
    );
  }

  const ring = (
    <KitActivityRings
      rings={activityRingsConfig(data)}
      size={dims.size}
      thickness={dims.thickness}
      gap={dims.gap}
    />
  );

  if (!showLabels) {
    return <View className={className}>{ring}</View>;
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
      {/* Column on phone, row at sm+ (Tamagui media — same on web + RN). */}
      <YStack items="center" gap="$5" $sm={{ flexDirection: "row" }}>
        {ring}
        <YStack minW={0} flex={1} gap="$3">
          {CATEGORIES.map(({ key, label, color, icon: Icon }) => (
            <XStack key={key} items="center" gap="$3">
              {/* Ring colors are viz CSS vars — kept via the style hatch so the
                  legend icon matches the kit ring's stroke. */}
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
