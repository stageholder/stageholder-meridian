import { Skeleton, Stat, XStack, YStack } from "@stageholder/ui";

/** One KPI tile in the dashboard stat row. */
export interface DashboardStatItem {
  key: string;
  label: string;
  /**
   * Numeric value → animated count-up + optional compact formatting. Use for
   * single-number metrics (Light earned, streak days).
   */
  value?: number;
  /**
   * Pre-formatted display when the metric isn't a single number, e.g. a ratio
   * like "3 / 5". Rendered verbatim (no count animation). Ignored if `value`
   * is provided.
   */
  display?: string;
  /** Abbreviate large numbers (1.2k) — only meaningful with `value`. */
  compact?: boolean;
  /**
   * Optional trend vs the comparison period (e.g. yesterday). Omit entirely
   * when a clean comparison isn't available — better no delta than a fake one.
   */
  delta?: { direction: "up" | "down" | "flat"; label: string };
}

export interface DashboardStatsProps {
  stats: DashboardStatItem[];
  /** Min tile width before wrapping to the next row. Default 132. */
  minTileWidth?: number;
  /**
   * Chromeless tiles (transparent, no border/padding) — for embedding the KPIs
   * as a strip INSIDE another card (e.g. the dashboard hero) rather than as a
   * standalone row of bordered cards.
   */
  plain?: boolean;
  /** Cold-loading — render skeleton tiles instead of the (zeroed) numbers. */
  loading?: boolean;
}

/**
 * A responsive row of kit `Stat` KPI tiles — the dashboard's at-a-glance
 * numbers (Light, streak, todos, habits, journal) with up/down deltas. Each
 * `Stat` is self-chromed (card + hairline border); tiles flex to fill the row
 * on wide screens and wrap to 2–3 per row on narrow ones. Cross-platform: the
 * host places this full-width (web) or as a wrapping section (mobile).
 */
export function DashboardStats({
  stats,
  minTileWidth = 132,
  plain,
  loading,
}: DashboardStatsProps) {
  if (loading) {
    return (
      <XStack flexWrap="wrap" gap={plain ? "$5" : "$3"}>
        {stats.map((s) => (
          <YStack
            key={s.key}
            flex={1}
            minW={minTileWidth}
            gap="$2"
            py={plain ? 0 : "$3"}
            px={plain ? 0 : "$3"}
          >
            <Skeleton width={64} height={11} rounded="$2" />
            <Skeleton width={48} height={24} rounded="$2" />
          </YStack>
        ))}
      </XStack>
    );
  }
  return (
    <XStack flexWrap="wrap" gap={plain ? "$5" : "$3"}>
      {stats.map((s) => (
        <Stat key={s.key} flex={1} minW={minTileWidth} plain={plain}>
          <Stat.Label>{s.label}</Stat.Label>
          {s.value !== undefined ? (
            <Stat.Value
              value={s.value}
              animate
              format={s.compact ? "compact" : undefined}
            />
          ) : (
            <Stat.Value>{s.display ?? "—"}</Stat.Value>
          )}
          {s.delta ? (
            <Stat.Delta>
              <Stat.DeltaLabel
                up={s.delta.direction === "up"}
                down={s.delta.direction === "down"}
                flat={s.delta.direction === "flat"}
              >
                {s.delta.label}
              </Stat.DeltaLabel>
            </Stat.Delta>
          ) : null}
        </Stat>
      ))}
    </XStack>
  );
}
