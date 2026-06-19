import { Check, CheckSquare, BookOpen, Target } from "@tamagui/lucide-icons-2";
import {
  Button,
  Paragraph,
  Text,
  ToggleGroup,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";

const GOALS = [
  {
    id: "productivity",
    label: "Productivity",
    description: "Manage tasks and stay organized",
    icon: CheckSquare,
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

      {/* Kit ToggleGroup cards variant — multi-select. The shell constrains
          onboarding to ~576px, so the kit's cards always render as a single
          full-width column (it collapses to 1 col ≤ 800px). Full-width cards
          read best as horizontal ROWS — tinted icon tile + title/description +
          a selected check — rather than the kit's default centered vertical
          stack, which leaves the icon floating in dead space. We keep the kit
          chrome (border/tint on active) and compose the row inside each item. */}
      <ToggleGroup
        variant="cards"
        type="multiple"
        value={selectedGoals}
        onValueChange={onGoalsChange}
      >
        {GOALS.map((goal) => {
          const Icon = goal.icon;
          const selected = selectedGoals.includes(goal.id);
          return (
            <ToggleGroup.Item
              key={goal.id}
              value={goal.id}
              aria-label={goal.label}
            >
              <XStack width="100%" items="center" gap="$3">
                {/* Icon tile — flips to a solid brand fill when selected so the
                    cue reads even against the card's faint active tint. */}
                <View
                  height={44}
                  width={44}
                  shrink={0}
                  items="center"
                  justify="center"
                  rounded="$lg"
                  transition="quick"
                  bg={selected ? "$primary" : "$muted"}
                >
                  <Icon
                    size={22}
                    color={selected ? "$primaryForeground" : "$mutedForeground"}
                  />
                </View>

                {/* Title + description block fills the remaining width. */}
                <YStack flex={1} minW={0} gap="$1">
                  <Text fontSize="$4" fontWeight="600" color="$color">
                    {goal.label}
                  </Text>
                  <Text fontSize="$2" color="$mutedForeground">
                    {goal.description}
                  </Text>
                </YStack>

                {/* Multi-select check — present only when selected. A fixed
                    slot keeps the text block from reflowing on toggle. */}
                <View width={22} shrink={0} items="center" justify="center">
                  {selected ? <Check size={20} color="$primary" /> : null}
                </View>
              </XStack>
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
