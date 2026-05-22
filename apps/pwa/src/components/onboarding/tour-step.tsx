import {
  CheckSquare,
  Heart,
  BookOpen,
  Target,
  CalendarDays,
  Home,
} from "lucide-react";
import { Button, Paragraph, Text, XStack, YStack } from "@stageholder/ui";

interface Feature {
  icon: typeof Home;
  title: string;
  description: string;
  goals: string[];
}

const FEATURES: Feature[] = [
  {
    icon: Home,
    title: "Dashboard",
    description:
      "See your day at a glance with activity rings and upcoming tasks.",
    goals: [],
  },
  {
    icon: CheckSquare,
    title: "Todos",
    description: "Organize tasks with priorities, due dates, and subtasks.",
    goals: ["productivity"],
  },
  {
    icon: Target,
    title: "Habits",
    description: "Track daily habits and build streaks over time.",
    goals: ["health", "habits"],
  },
  {
    icon: BookOpen,
    title: "Journal",
    description: "Write daily reflections to capture your thoughts.",
    goals: ["journaling"],
  },
  {
    icon: CalendarDays,
    title: "Calendar",
    description: "View all your tasks and habits in a calendar view.",
    goals: ["productivity", "habits"],
  },
  {
    icon: Heart,
    title: "Health Tracking",
    description: "Monitor your wellness habits and see your progress.",
    goals: ["health"],
  },
];

export function TourStep({
  selectedGoals,
  onContinue,
}: {
  selectedGoals: string[];
  onContinue: () => void;
}) {
  // Show dashboard always, plus features matching selected goals. If no goals selected, show all.
  const filtered =
    selectedGoals.length === 0
      ? FEATURES
      : FEATURES.filter(
          (f) =>
            f.goals.length === 0 ||
            f.goals.some((g) => selectedGoals.includes(g)),
        );

  return (
    <YStack gap="$6">
      <YStack gap="$2">
        <Text fontSize="$7" fontWeight="700" color="$color">
          Here&apos;s what you can do
        </Text>
        <Paragraph fontSize="$3" color="$mutedForeground">
          A quick look at the features tailored for you.
        </Paragraph>
      </YStack>

      <YStack gap="$3">
        {filtered.map((feature, i) => {
          const Icon = feature.icon;
          return (
            <XStack
              key={feature.title}
              items="flex-start"
              gap="$3"
              rounded="$lg"
              borderWidth={1}
              borderColor="$borderColor"
              p="$3"
              // Tamagui v2 native staggered mount fade (animations.md): start
              // transparent, animate to base on mount, delayed per index.
              enterStyle={{ opacity: 0 }}
              transition={["medium", { delay: i * 100 }]}
            >
              {/* Icon badge: 36px square, $primaryMuted bg (= bg-primary/10) */}
              <XStack
                width={36}
                height={36}
                shrink={0}
                items="center"
                justify="center"
                rounded="$md"
                bg="$primaryMuted"
              >
                <Text color="$primary">
                  <Icon size={16} />
                </Text>
              </XStack>
              <YStack>
                <Text fontSize="$3" fontWeight="500" color="$color">
                  {feature.title}
                </Text>
                <Text fontSize="$1" color="$mutedForeground">
                  {feature.description}
                </Text>
              </YStack>
            </XStack>
          );
        })}
      </YStack>

      <Button width="100%" onPress={onContinue}>
        Continue
      </Button>
    </YStack>
  );
}
