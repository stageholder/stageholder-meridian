import { Stat, XStack } from "@stageholder/ui";

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
}: DashboardStatsProps) {
  return (
    <XStack flexWrap="wrap" gap="$3">
      {stats.map((s) => (
        <Stat key={s.key} flex={1} minW={minTileWidth}>
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
