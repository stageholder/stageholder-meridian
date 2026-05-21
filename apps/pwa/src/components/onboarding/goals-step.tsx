import { CheckSquare, Heart, BookOpen, Target } from "lucide-react";
import { Button, Text, ToggleGroup, YStack } from "@stageholder/ui";

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
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-foreground">
          What are your goals?
        </h2>
        <p className="text-sm text-muted-foreground">
          Select what you&apos;d like to focus on. This helps us personalize
          your experience.
        </p>
      </div>

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
                <Icon className="size-6 text-muted-foreground" />
                <Text fontSize="$3" fontWeight="500" color="$color">
                  {goal.label}
                </Text>
                <Text fontSize="$2" color="$mutedForeground">
                  {goal.description}
                </Text>
              </YStack>
            </ToggleGroup.Item>
          );
        })}
      </ToggleGroup>

      <Button className="w-full" onPress={onContinue}>
        Continue
      </Button>
    </div>
  );
}
