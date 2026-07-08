import { Link } from "@tanstack/react-router";
import { Separator, View, XStack, YStack } from "@stageholder/ui";
import type { UserLight } from "@repo/core/types/light";
import { LevelProgress } from "@repo/features/light";
import {
  DashboardStats,
  type DashboardStatItem,
} from "@repo/features/dashboard";
import { ActivityRings } from "@/components/activity-rings";

interface DashboardHeroProps {
  date: string;
  userLight?: UserLight;
  /** The at-a-glance KPIs (Light, streak, todos, habits, journal) with deltas. */
  stats: DashboardStatItem[];
  /** Cold-loading — the KPI strip shows a skeleton instead of flashing zeros. */
  statsLoading?: boolean;
}

/**
 * The dashboard's unified "daily summary" card — one glance for everything:
 *
 *   ┌───────────────────────────────────────────────┐
 *   │  ◎ rings   Flame ─────────── Radiant           │  ← motivation zone
 *   │            350/400 · 1.5x streak                │    (links to /journey)
 *   ├───────────────────────────────────────────────┤  ← divider
 *   │  LIGHT · STREAK · TODOS · HABITS · JOURNAL      │  ← chromeless KPI strip
 *   └───────────────────────────────────────────────┘
 *
 * Follows the fitness/productivity "hero + stat strip" pattern (Apple Fitness /
 * Oura / Todoist): a primary emotional anchor (rings + level) over a divider,
 * then supporting metrics as a borderless strip — one cohesive unit instead of
 * a card plus a separate row of five bordered tiles. The kit `Dashboard.Widget`
 * owns the outer card chrome.
 */
export function DashboardHero({
  date,
  userLight,
  stats,
  statsLoading,
}: DashboardHeroProps) {
  return (
    <YStack gap="$4">
      {/* Motivation zone — rings + level, links to the progress home. Rings
          centered above on phones; beside the level from $md up. */}
      <Link to="/journey" style={{ display: "block", textDecoration: "none" }}>
        <YStack gap="$5" $md={{ flexDirection: "row", items: "center" }}>
          <XStack justify="center" shrink={0} $md={{ justify: "flex-start" }}>
            <ActivityRings date={date} size="xl" bare />
          </XStack>
          <View flex={1} minW={0} width="100%">
            {userLight ? <LevelProgress userLight={userLight} /> : null}
          </View>
        </YStack>
      </Link>

      <Separator />

      {/* KPI strip — the same metrics, chromeless (no per-tile borders). */}
      <DashboardStats
        stats={stats}
        plain
        minTileWidth={110}
        loading={statsLoading}
      />
    </YStack>
  );
}
