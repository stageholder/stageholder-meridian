// apps/mobile/app/(authed)/index.tsx
//
// Today — the dashboard. Aesthetic direction is "observatory":
//
//   - Calm dark-navy field
//   - ActivityRings as the central celestial widget (3 daily metrics)
//   - PulsingFire at the rings' center as "the light you've earned today"
//   - Streak + Heatmap below as supporting context
//   - FAB pinned bottom-right for quick capture
//
// All numbers are mocked (`lib/mock-data.ts`) until the Meridian API client
// exists. Replace the `MOCK_TODAY` import with React Query hooks once they're
// wired in — every consumer is just reading numbers, no shape changes needed.

import { useUser } from "@stageholder/sdk/react-native";
import {
  ActivityRings,
  Card,
  FAB,
  H2,
  Heatmap,
  Paragraph,
  StreakBadge,
  Text,
  XStack,
  YStack,
  useHaptic,
} from "@stageholder/ui";
import { useRouter } from "expo-router";
import { Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PulsingFire } from "@/components/PulsingFire";
import {
  MOCK_TODAY,
  generateRecentHeatmap,
  greeting,
  todayLabel,
} from "@/lib/mock-data";

const HEATMAP_DATA = generateRecentHeatmap();

export default function TodayScreen() {
  const { user } = useUser();
  const router = useRouter();
  const haptic = useHaptic();

  const stats = MOCK_TODAY;

  // Three rings, mapped to Meridian's three productivity surfaces.
  // Colors are intentionally not the brand — the brand color is reserved
  // for selection and primary actions; ring colors are categorical.
  const rings = [
    {
      value: stats.habits.done,
      max: stats.habits.total,
      color: "#ef4444", // habit-red
      label: "Habits",
    },
    {
      value: stats.journal.words,
      max: stats.journal.target,
      color: "#f59e0b", // journal-amber
      label: "Words",
    },
    {
      value: stats.todos.done,
      max: stats.todos.total,
      color: "#3b82f6", // todo-blue
      label: "Todos",
    },
  ];

  function handleQuickAdd() {
    haptic.impact("medium");
    Alert.alert(
      "Quick add",
      "Hook this to a Sheet that lets you create a todo, log a habit, or open the journal editor.",
    );
  }

  return (
    <YStack flex={1} bg="$background">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 96 }}
          showsVerticalScrollIndicator={false}
        >
          <YStack gap="$5" pt="$4">
            {/* ---- Header ---- */}
            <YStack gap="$1">
              <Paragraph
                fontFamily="$mono"
                fontSize={11}
                letterSpacing={2}
                textTransform="uppercase"
                color="$color11"
              >
                {todayLabel()}
              </Paragraph>
              <H2 color="$color12">
                {greeting()}
                {user?.name ? `, ${user.name.split(" ")[0]}` : ""}.
              </H2>
            </YStack>

            {/* ---- Activity rings + legend ---- */}
            <Card>
              <Card.Body py="$5" gap="$4" items="center">
                <ActivityRings size={196} rings={rings}>
                  <PulsingFire size={48} />
                </ActivityRings>
                <XStack gap="$5" flexWrap="wrap" justify="center">
                  {rings.map((r) => (
                    <YStack key={r.label} items="center" gap={2} minWidth={72}>
                      <XStack items="center" gap="$1.5">
                        <YStack
                          width={8}
                          height={8}
                          rounded={4}
                          bg={r.color as never}
                        />
                        <Text
                          fontSize={10}
                          letterSpacing={1.5}
                          textTransform="uppercase"
                          color="$color11"
                          fontWeight="600"
                        >
                          {r.label}
                        </Text>
                      </XStack>
                      <Text fontSize="$5" fontWeight="700" color="$color12">
                        {r.value}
                        <Text fontSize="$2" color="$color11" fontWeight="500">
                          {" / "}
                          {r.max}
                        </Text>
                      </Text>
                    </YStack>
                  ))}
                </XStack>
              </Card.Body>
            </Card>

            {/* ---- Streak strip ---- */}
            <XStack
              items="center"
              gap="$3"
              p="$4"
              rounded="$3"
              bg="$color2"
              borderWidth={1}
              borderColor="$color6"
            >
              <StreakBadge count={stats.streak} size="$4" label="day streak" />
              <Paragraph
                flex={1}
                fontSize="$2"
                color="$color11"
                lineHeight="$2"
              >
                Keep the chain alive.
                {stats.habits.done < stats.habits.total
                  ? ` ${stats.habits.total - stats.habits.done} habit${stats.habits.total - stats.habits.done === 1 ? "" : "s"} left to check today.`
                  : " You've checked everything today."}
              </Paragraph>
            </XStack>

            {/* ---- Last 30 days heatmap ---- */}
            <Card>
              <Card.Header>
                <YStack gap="$1">
                  <Paragraph
                    fontFamily="$mono"
                    fontSize={10}
                    letterSpacing={1.6}
                    textTransform="uppercase"
                    color="$color11"
                    fontWeight="600"
                  >
                    Last 30 days
                  </Paragraph>
                  <Paragraph fontSize="$3" color="$color12" fontWeight="500">
                    Habit consistency
                  </Paragraph>
                </YStack>
              </Card.Header>
              <Card.Body py="$3">
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <Heatmap
                    data={HEATMAP_DATA}
                    cellSize={14}
                    gap={3}
                    cellVariant="dot"
                    showWeekdayLabels
                  />
                </ScrollView>
              </Card.Body>
            </Card>

            {/* ---- Hint card ---- */}
            <Card>
              <Card.Body gap="$2">
                <Paragraph fontSize="$3" color="$color12" fontWeight="600">
                  This is a scaffold.
                </Paragraph>
                <Paragraph fontSize="$2" color="$color11" lineHeight="$2">
                  Numbers above are mock data. Wire React Query against the
                  Meridian API to make this live — every value here reads from{" "}
                  <Text fontFamily="$mono" fontSize="$1">
                    lib/mock-data.ts
                  </Text>
                  .
                </Paragraph>
              </Card.Body>
            </Card>
          </YStack>
        </ScrollView>
      </SafeAreaView>

      {/* FAB sits OUTSIDE the ScrollView so it floats above scroll. */}
      <FAB
        icon={<PlusGlyph />}
        placement="bottom-right"
        onPress={handleQuickAdd}
        // Lift it above the tab bar.
        b={88}
      />
    </YStack>
  );
}

function PlusGlyph() {
  return (
    <Text color="white" fontSize={28} fontWeight="300" lineHeight={28}>
      +
    </Text>
  );
}
