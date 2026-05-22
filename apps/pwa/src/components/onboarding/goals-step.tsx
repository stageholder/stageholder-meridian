import { CheckSquare, Heart, BookOpen, Target } from "lucide-react";
import { Button, Paragraph, Text, ToggleGroup, YStack } from "@stageholder/ui";

const GOALS = [
  {
    id: "productivity",
    label: "Productivity",
    description: "Manage tasks and stay organized",
    icon: CheckSquare,
  },
  {
    id: "health",
    label: "Health",
    description: "Build healthy habits and track progress",
    icon: Heart,
  },
  {
    id: "journaling",
    label: "Journaling",
    description: "Reflect and write daily entries",
    icon: BookOpen,
  },
  {
    id: "habits",
    label: "Habit Tracking",
    description: "Create routines and maintain streaks",
    icon: Target,
  },
] as const;

export function GoalsStep({
  selectedGoals,
  onGoalsChange,
  onContinue,
}: {
  selectedGoals: string[];
  onGoalsChange: (goals: string[]) => void;
  onContinue: () => void;
}) {
  return (
    <YStack gap="$6">
      <YStack gap="$2">
        <Text fontSize="$7" fontWeight="700" color="$color">
          What are your goals?
        </Text>
        <Paragraph fontSize="$3" color="$mutedForeground">
          Select what you&apos;d like to focus on. This helps us personalize
          your experience.
        </Paragraph>
      </YStack>

      {/* Kit ToggleGroup cards variant — multi-select. Default 2 cols at
          >= sm matches the previous custom 2x2 grid; mobile collapses to
          1 col automatically. Active state uses kit's $primary +
          $primaryMuted chrome (no per-goal color identity, matching the
          previous "all goals share primary" pattern). */}
      <ToggleGroup
        variant="cards"
        type="multiple"
        value={selectedGoals}
        onValueChange={onGoalsChange}
      >
        {GOALS.map((goal) => {
          const Icon = goal.icon;
          return (
            <ToggleGroup.Item key={goal.id} value={goal.id}>
              <YStack items="center" gap="$2">
                {/* Icon wrapped in Text to relay currentColor via CSS */}
                <Text color="$mutedForeground">
                  <Icon size={24} />
                </Text>
                <Text fontSize="$3" fontWeight="500" color="$color">
                  {goal.label}
                </Text>
                <Text fontSize="$2" color="$mutedForeground" text="center">
                  {goal.description}
                </Text>
              </YStack>
            </ToggleGroup.Item>
          );
        })}
      </ToggleGroup>

      <Button width="100%" onPress={onContinue}>
        Continue
      </Button>
    </YStack>
  );
}
