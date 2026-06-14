// packages/features/src/onboarding/goals-step.native.tsx
//
// Native build of GoalsStep — prop-for-prop identical to goals-step.tsx (the
// web source of truth), but it does NOT use the kit ToggleGroup `cards`
// variant. That variant decides "is this a phone?" via `media.sm` expecting
// max-width semantics; this app's mobile Tamagui config uses MIN-width media,
// so `media.sm` is false on a phone and the kit falls into its desktop branch
// (48%-wide cells in a wrapping row) — the card collapses and the description
// text wraps one character per line.
//
// Instead we render a plain YStack of full-width pressable card rows: tinted
// icon tile + title/description + a selected check. Robust regardless of the
// media config, and the same row anatomy the web version composes inside the
// kit chrome.

import {
  Check,
  CheckSquare,
  Heart,
  BookOpen,
  Target,
} from "@tamagui/lucide-icons-2";
import {
  Button,
  Paragraph,
  Text,
  View,
  XStack,
  YStack,
  usePressScale,
} from "@stageholder/ui";
import type { NamedExoticComponent } from "react";

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

type Goal = (typeof GOALS)[number];

/** One selectable goal card. A component (not inline) so `usePressScale` —
 *  which can't run inside a `.map` — gets its own hook instance per row. */
function GoalCard({
  goal,
  selected,
  onToggle,
}: {
  goal: Goal;
  selected: boolean;
  onToggle: () => void;
}) {
  const Icon = goal.icon as NamedExoticComponent<{
    size?: number;
    color?: string;
  }>;
  const { handlers, pressProps } = usePressScale({
    onPress: onToggle,
    haptic: "none",
  });

  return (
    <XStack
      {...handlers}
      {...pressProps}
      role="button"
      aria-label={goal.label}
      width="100%"
      items="center"
      gap="$3"
      p="$4"
      rounded="$3"
      borderWidth={1}
      transition="quick"
      borderColor={selected ? "$primary" : "$borderColor"}
      bg={selected ? "$primaryMuted" : "transparent"}
    >
      {/* Icon tile — solid brand fill when selected so the cue reads even
          against the card's faint active tint. */}
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

      {/* Title + description block fills the remaining width. minW={0} lets it
          actually shrink so the description wraps by word, not character. */}
      <YStack flex={1} minW={0} gap="$1">
        <Text fontSize="$4" fontWeight="600" color="$color">
          {goal.label}
        </Text>
        <Text fontSize="$2" color="$mutedForeground">
          {goal.description}
        </Text>
      </YStack>

      {/* Multi-select check — fixed slot keeps the text block from reflowing
          on toggle. */}
      <View width={22} shrink={0} items="center" justify="center">
        {selected ? <Check size={20} color="$primary" /> : null}
      </View>
    </XStack>
  );
}

export function GoalsStep({
  selectedGoals,
  onGoalsChange,
  onContinue,
}: {
  selectedGoals: string[];
  onGoalsChange: (goals: string[]) => void;
  onContinue: () => void;
}) {
  function toggle(id: string) {
    onGoalsChange(
      selectedGoals.includes(id)
        ? selectedGoals.filter((g) => g !== id)
        : [...selectedGoals, id],
    );
  }

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

      <YStack gap="$3">
        {GOALS.map((goal) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            selected={selectedGoals.includes(goal.id)}
            onToggle={() => toggle(goal.id)}
          />
        ))}
      </YStack>

      <Button width="100%" onPress={onContinue}>
        Continue
      </Button>
    </YStack>
  );
}
