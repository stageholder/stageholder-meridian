// packages/features/src/onboarding/onboarding-wizard.tsx
//
// The Meridian onboarding wizard, built on the KIT's config-driven
// `Onboarding` component (@stageholder/ui) instead of a hand-rolled shell.
// The kit owns the structure + UX — progress dots, animated step transitions,
// back/skip/next, validation gating, the Stageholder brand header, and the
// finish button's loading state. We declare our STEPS as data and hand it a
// single `onComplete(values)`.
//
// Cross-platform: this ONE component renders on web + native (the kit's
// Onboarding is platform-agnostic), so it replaces both apps' bespoke wizard
// shells AND the old `goals-step.native.tsx` split (the kit's `multi` step
// renders the option cards correctly on both).
//
// The host owns only the data + side effects: it fetches the initial profile,
// passes `firstName` + `initialProfile`, and implements `onComplete` (save the
// profile + mark onboarding complete + route) and `onSkip` (mark complete +
// route, no profile save). `onComplete` runs at the END of the wizard — the
// kit's Next button only advances, so a mid-wizard blocking save doesn't fit
// its model; the profile is saved on finish alongside completion.

import { useMemo } from "react";
import {
  Onboarding,
  Input,
  Label,
  Text,
  XStack,
  YStack,
  type OnboardingStep,
  type OnboardingValues,
} from "@stageholder/ui";
import {
  BookOpen,
  CalendarDays,
  Check,
  CheckSquare,
  Home,
  Target,
} from "@tamagui/lucide-icons-2";

import { TimezoneSelect } from "../settings/timezone-select";

/** The profile step's answer shape (stored in `values.profile`). */
export interface OnboardingProfileValue {
  displayName: string;
  timezone: string;
}

export const ONBOARDING_STEP_IDS = {
  welcome: "welcome",
  profile: "profile",
  goals: "goals",
  tour: "tour",
  complete: "complete",
} as const;

/** Best-effort device timezone (Hermes supports resolvedOptions().timeZone). */
function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/* ------------------------------ goal options ------------------------------ */

const GOAL_OPTIONS = [
  {
    value: "productivity",
    label: "Productivity",
    description: "Manage tasks and stay organized",
    icon: <CheckSquare size={20} color="$primary" />,
  },
  {
    value: "journaling",
    label: "Journaling",
    description: "Reflect and write daily entries",
    icon: <BookOpen size={20} color="$primary" />,
  },
  {
    value: "habits",
    label: "Habit Tracking",
    description: "Create routines and maintain streaks",
    icon: <Target size={20} color="$primary" />,
  },
];

/* ------------------------------ tour features ----------------------------- */

interface Feature {
  icon: typeof Home;
  title: string;
  description: string;
  /** Empty = always shown; else shown when any listed goal is selected. */
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
    goals: ["habits"],
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
];

/** The `content` body for the Tour step — feature cards filtered by the goals
 *  picked on the previous step (all shown when none were selected). */
function TourFeatures({ selectedGoals }: { selectedGoals: string[] }) {
  const filtered =
    selectedGoals.length === 0
      ? FEATURES
      : FEATURES.filter(
          (f) =>
            f.goals.length === 0 ||
            f.goals.some((g) => selectedGoals.includes(g)),
        );
  return (
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
            enterStyle={{ opacity: 0 }}
            transition={["medium", { delay: i * 100 }]}
          >
            <XStack
              width={36}
              height={36}
              shrink={0}
              items="center"
              justify="center"
              rounded="$md"
              bg="$primaryMuted"
            >
              <Icon size={16} color="$primary" />
            </XStack>
            <YStack flex={1} minW={0} gap="$0.5">
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
  );
}

/* ------------------------------ profile fields ---------------------------- */

/** The `content` body for the Profile step — name + timezone, written into the
 *  step's value object. */
function ProfileFields({
  value,
  onChange,
}: {
  value: OnboardingProfileValue;
  onChange: (value: OnboardingProfileValue) => void;
}) {
  return (
    <YStack gap="$4">
      <YStack gap="$1.5">
        <Label htmlFor="onboard-name">Display name</Label>
        <Input
          id="onboard-name"
          value={value.displayName}
          onChangeText={(t) => onChange({ ...value, displayName: t })}
        />
      </YStack>
      <YStack gap="$1.5">
        <Label htmlFor="onboard-tz">Timezone</Label>
        <TimezoneSelect
          value={value.timezone}
          onValueChange={(tz) => onChange({ ...value, timezone: tz })}
        />
      </YStack>
    </YStack>
  );
}

/* ------------------------------- step config ------------------------------ */

function buildSteps(firstName: string): OnboardingStep[] {
  const tz = deviceTimezone();
  return [
    {
      type: "intro",
      id: ONBOARDING_STEP_IDS.welcome,
      title: firstName
        ? `Welcome to Meridian, ${firstName}!`
        : "Welcome to Meridian!",
      description:
        "Your personal productivity companion for tasks, habits, journaling, and more. Let's get you set up in just a few steps.",
    },
    {
      type: "content",
      id: ONBOARDING_STEP_IDS.profile,
      title: "Confirm your profile",
      description:
        "Edit your name and timezone here. They sync with your Stageholder account and follow you across products.",
      render: (ctx) => {
        const v = (ctx.value as OnboardingProfileValue | undefined) ?? {
          displayName: "",
          timezone: tz,
        };
        return (
          <ProfileFields value={v} onChange={(next) => ctx.setValue(next)} />
        );
      },
      // Gate Next on a non-empty name.
      isComplete: (value) => {
        const v = value as OnboardingProfileValue | undefined;
        return !!v?.displayName?.trim();
      },
    },
    {
      type: "multi",
      id: ONBOARDING_STEP_IDS.goals,
      title: "What are your goals?",
      description:
        "Select what you'd like to focus on. This helps us personalize your experience.",
      // Not required — Continue advances even with nothing selected (parity).
      options: GOAL_OPTIONS,
    },
    {
      type: "content",
      id: ONBOARDING_STEP_IDS.tour,
      title: "Here's what you can do",
      description: "A quick look at the features tailored for you.",
      render: (ctx) => (
        <TourFeatures
          selectedGoals={
            Array.isArray(ctx.values[ONBOARDING_STEP_IDS.goals])
              ? (ctx.values[ONBOARDING_STEP_IDS.goals] as string[])
              : []
          }
        />
      ),
    },
    {
      type: "intro",
      id: ONBOARDING_STEP_IDS.complete,
      title: "You're all set!",
      description:
        "You're ready to go. Start building habits, tracking tasks, and journaling your journey.",
      media: (
        <XStack
          width={64}
          height={64}
          items="center"
          justify="center"
          rounded={9999}
          bg="$primaryMuted"
        >
          <Check size={32} color="$primary" />
        </XStack>
      ),
    },
  ];
}

/* -------------------------------- wizard ---------------------------------- */

export interface OnboardingWizardProps {
  /** First name for the welcome step (host resolves it from the session). */
  firstName: string;
  /** Seed for the profile step — fetched by the host BEFORE mounting this. */
  initialProfile: OnboardingProfileValue;
  /** End of the wizard: save the profile + mark completion + route. MUST NOT
   *  throw — handle its own errors (toast) so the kit's finish resolves. */
  onComplete: (values: OnboardingValues) => Promise<void> | void;
  /** The header close (X) affordance — "skip setup": mark complete + route,
   *  no profile save. Omit to hide the X. */
  onSkip?: () => void;
}

export function OnboardingWizard({
  firstName,
  initialProfile,
  onComplete,
  onSkip,
}: OnboardingWizardProps) {
  const steps = useMemo(() => buildSteps(firstName), [firstName]);
  // Captured once by the kit (uncontrolled) — the host mounts this only AFTER
  // the profile fetch resolves, so the seed is correct from first paint.
  const defaultValues = useMemo<OnboardingValues>(
    () => ({ [ONBOARDING_STEP_IDS.profile]: initialProfile }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <Onboarding
      steps={steps}
      defaultValues={defaultValues}
      onComplete={onComplete}
      onClose={onSkip}
      progress="dots"
      nextLabel="Continue"
      finishLabel="Go to Dashboard"
      maxWidth={576}
    />
  );
}
