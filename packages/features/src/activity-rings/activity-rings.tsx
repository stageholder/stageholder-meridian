import { CheckSquare, Target, BookOpen } from "lucide-react";
import {
  ActivityRings as KitActivityRings,
  ProgressRing,
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
      <YStack
        width="100%"
        items="center"
        gap="$5"
        $sm={{ flexDirection: "row" }}
      >
        {ring}
        {/* Phone (column): full-width so the legend rows span the card and
            don't collapse to a centered content-width block. sm+ (row): drop
            the explicit width and flex-fill the space beside the ring.
            `flex={1}`'s flexBasis:0% alone left it content-width in the column,
            which is what made the rows pile up / overlap on mobile. */}
        <YStack
          minW={0}
          width="100%"
          gap="$3"
          $sm={{ width: "auto", flexGrow: 1, flexShrink: 1, flexBasis: 0 }}
        >
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

export interface ActivityRingsBreakdownProps {
  data: ActivityRingsData;
  details: ActivityRingsDetails;
  isLoading?: boolean;
  className?: string;
}

/**
 * Companion to `<ActivityRings>`: a vertical, per-category breakdown meant
 * for its own card (below the combined rings + level progress). Each row
 * pairs the category label + `fraction · %` on the left with a small
 * single-category `<ProgressRing>` on the right — the same row pattern as
 * the header's daily-target popover, flipped so the ring trails the text.
 *
 * Presentational only: the host feeds the same `data`/`details` it passes
 * to `<ActivityRings>` (the per-day hook is cached, so calling it for both
 * cards is free). Cross-platform — kit primitives only, no `.native.tsx`.
 */
export function ActivityRingsBreakdown({
  data,
  details,
  isLoading,
  className,
}: ActivityRingsBreakdownProps) {
  if (isLoading) {
    return (
      <YStack gap="$4" className={className}>
        {[0, 1, 2].map((i) => (
          <XStack key={i} items="center" gap="$3">
            <YStack flex={1} gap="$1.5">
              <Skeleton height={16} width={84} />
              <Skeleton height={12} width={132} />
            </YStack>
            <Skeleton height={48} width={48} rounded={9999} />
          </XStack>
        ))}
      </YStack>
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
    <YStack gap="$4" className={className}>
      {CATEGORIES.map(({ key, label, color, icon: Icon }) => {
        const pct = percentages[key];
        return (
          <XStack key={key} items="center" gap="$3" width="100%">
            {/* Label + value fill the row; minW:0 lets the value truncate
                instead of pushing the ring off the edge on narrow cards. */}
            <YStack flex={1} minW={0} gap="$0.5">
              <Text fontSize="$4" fontWeight="600" color="$color">
                {label}
              </Text>
              <Text
                fontSize="$2"
                color="$mutedForeground"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {fractions[key]} · {pct}%
              </Text>
            </YStack>
            {/* Single-category ring on the trailing edge — same viz colors as
                the combined <ActivityRings>, via the kit ProgressRing. */}
            <ProgressRing
              value={pct}
              size={48}
              thickness={4}
              fillColor={color}
              trackColor={RING_CATEGORY[key].track}
            >
              {/* Ring color flows to the lucide icon via currentColor. */}
              <Text shrink={0} lineHeight={0} style={{ color }}>
                <Icon size={18} />
              </Text>
            </ProgressRing>
          </XStack>
        );
      })}
    </YStack>
  );
}
