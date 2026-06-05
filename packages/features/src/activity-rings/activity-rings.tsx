import { CheckSquare, Target, BookOpen } from "@tamagui/lucide-icons-2";
import {
  ActivityRings as KitActivityRings,
  ProgressRing,
  Skeleton,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import { tabularNums } from "../_internal/text-styles";
import {
  activityRingsConfig,
  RING_CATEGORY,
  type ActivityRingsData,
  type ActivityRingsDetails,
  type RingColorMap,
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
  { key: "todo" as const, label: "Todos", icon: CheckSquare },
  { key: "habit" as const, label: "Habits", icon: Target },
  { key: "journal" as const, label: "Journal", icon: BookOpen },
] as const;

/**
 * Per-category ring colors: the `color` (stroke/fill + matching legend icon)
 * and `track` (ring background). Mirrors `RING_CATEGORY`'s shape.
 *
 * Web's default is `RING_CATEGORY` — theme-aware CSS custom properties
 * (`var(--ring-todo)` …). Those resolve in the browser but NOT in
 * react-native-svg (no CSS-var resolver), so a native caller MUST pass
 * resolved hex/rgba here (e.g. the mobile `IGNITION` palette). lucide-icons-2
 * and the kit `ProgressRing`/`ActivityRings` all read these straight as SVG
 * stroke/fill, so an unresolved `var(...)` would render at the icon's #000
 * fallback and an invalid ring color on native.
 *
 * Same shape as `activityRingsConfig`'s `colors` param — aliased so the rings
 * visual and its config helper share one color-map contract.
 */
export type ActivityRingsColors = RingColorMap;

export interface ActivityRingsProps {
  data: ActivityRingsData;
  details: ActivityRingsDetails;
  isLoading?: boolean;
  size?: ActivityRingsSize;
  showLabels?: boolean;
  bare?: boolean;
  className?: string;
  /**
   * Per-category ring + legend-icon colors. Defaults to the web CSS-var map
   * (`RING_CATEGORY`); native callers MUST pass resolved hex/rgba (e.g. the
   * mobile IGNITION palette) since react-native-svg can't resolve `var(...)`.
   */
  colors?: ActivityRingsColors;
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
  colors = RING_CATEGORY,
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
      rings={activityRingsConfig(data, colors)}
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
          {CATEGORIES.map(({ key, label, icon: Icon }) => (
            <XStack key={key} items="center" gap="$3">
              {/* Ring colors are viz accents — lucide-icons-2 reads its own
                  `color` so the legend icon matches the ring's stroke. Resolved
                  hex on native; CSS var on web (default `colors`). */}
              <Icon size={16} shrink={0} color={colors[key].color} />
              <YStack minW={0} flex={1}>
                <Text fontSize="$3" fontWeight="500" color="$color">
                  {label}
                </Text>
                <Text
                  fontSize="$1"
                  color="$mutedForeground"
                  style={tabularNums}
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
  /**
   * Per-category ring + icon colors. Same contract as `ActivityRings.colors`:
   * defaults to the web CSS-var map; native callers MUST pass resolved colors
   * (react-native-svg can't resolve `var(...)`, so the ProgressRing fill/track
   * and legend icon would otherwise break silently).
   */
  colors?: ActivityRingsColors;
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
 * cards is free). Cross-platform — kit primitives only, no `.native.tsx` —
 * but it renders SVG rings/icons, so a native host MUST pass resolved `colors`
 * (the CSS-var default only resolves in the browser). See `colors` above.
 */
export function ActivityRingsBreakdown({
  data,
  details,
  isLoading,
  className,
  colors = RING_CATEGORY,
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
      {CATEGORIES.map(({ key, label, icon: Icon }) => {
        const pct = percentages[key];
        const { color, track } = colors[key];
        return (
          <XStack key={key} items="center" gap="$3" width="100%">
            {/* Label + value fill the row; minW:0 lets the value truncate
                instead of pushing the ring off the edge on narrow cards. */}
            <YStack flex={1} minW={0} gap="$0.5">
              <Text fontSize="$4" fontWeight="600" color="$color">
                {label}
              </Text>
              <Text fontSize="$2" color="$mutedForeground" style={tabularNums}>
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
              trackColor={track}
            >
              {/* lucide-icons-2 reads its own `color` (no CSS cascade). */}
              <Icon size={18} shrink={0} color={color} />
            </ProgressRing>
          </XStack>
        );
      })}
    </YStack>
  );
}
