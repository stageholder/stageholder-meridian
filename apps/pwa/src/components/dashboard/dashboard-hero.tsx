import { Link } from "@tanstack/react-router";
import { View, XStack, YStack } from "@stageholder/ui";
import type { UserLight } from "@repo/core/types/light";
import { LevelProgress } from "@repo/features/light";
import { ActivityRings } from "@/components/activity-rings";

interface DashboardHeroProps {
  date: string;
  userLight?: UserLight;
}

/**
 * CONTENT-ONLY hero body for the dashboard's motivation widget: the XL activity
 * rings beside the Light/level progress. The kit `Dashboard.Widget` in the host
 * owns the card chrome. The per-category breakdown that used to live here is now
 * the dedicated `DashboardStats` KPI row (richer — it carries deltas). The whole
 * body links to /journey (the progress home).
 */
export function DashboardHero({ date, userLight }: DashboardHeroProps) {
  return (
    <Link to="/journey" style={{ display: "block", textDecoration: "none" }}>
      {/* Rings centered above on phones; beside the level from $md up. */}
      <YStack gap="$5" $md={{ flexDirection: "row", items: "center" }}>
        <XStack justify="center" shrink={0} $md={{ justify: "flex-start" }}>
          <ActivityRings date={date} size="xl" bare />
        </XStack>
        <View flex={1} minW={0} width="100%">
          {userLight ? <LevelProgress userLight={userLight} /> : null}
        </View>
      </YStack>
    </Link>
  );
}
