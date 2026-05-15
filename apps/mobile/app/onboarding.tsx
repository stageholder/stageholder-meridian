// apps/mobile/app/onboarding.tsx
//
// First-launch ignition. Four steps:
//
//   01 — Welcome           ("Light, kept." with three sample rings at 100%)
//   02 — Daily rhythm      (todo + journal-word preset pills)
//   03 — What you ignite   (pick 1+ starter habits from a curated grid)
//   04 — Ready             (final confirmation + "Enter Meridian")
//
// The flow is held entirely in component state — not in the URL — because
// a back-swipe in Expo Router would otherwise unmount the previous step
// and lose the user's draft selections. This makes the transitions feel
// like a single coherent experience rather than four separate routes.
//
// Once completed: markOnboarded() persists per-account in expo-secure-store,
// and authed/_layout.tsx stops redirecting here.

import { useStageholder, useUser } from "@stageholder/sdk/react-native";
import {
  ActivityRings,
  Banner,
  Button,
  H1,
  H2,
  Paragraph,
  Spinner,
  Text,
  XStack,
  YStack,
  useHaptic,
  useToast,
} from "@stageholder/ui";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  extractServerMessage,
  useCreateHabit,
  useUpdateTargets,
} from "@/lib/api";
import { IGNITION } from "@/lib/ignition-palette";
import { markOnboarded } from "@/lib/onboarding";

// ─── Preset data ────────────────────────────────────────────────────────────

const TODO_PRESETS = [
  { value: 3, label: "Lean" },
  { value: 5, label: "Standard" },
  { value: 8, label: "Active" },
  { value: 12, label: "Heavy" },
  { value: 20, label: "Marathon" },
] as const;

const WORD_PRESETS = [
  { value: 50, label: "Light" },
  { value: 150, label: "Standard" },
  { value: 250, label: "Moderate" },
  { value: 500, label: "Deep" },
  { value: 750, label: "Extensive" },
] as const;

type HabitSeed = {
  id: string;
  glyph: string;
  name: string;
  hint: string;
  color: string;
};

// Curated starter habits — each one has its own personality color (drawn
// from the existing AddHabitSheet palette, varied so the grid reads as a
// constellation rather than a uniform block).
const HABIT_SEEDS: readonly HabitSeed[] = [
  {
    id: "move",
    glyph: "◑",
    name: "Move",
    hint: "Walk, gym, dance",
    color: "#ef4444",
  },
  {
    id: "hydrate",
    glyph: "◌",
    name: "Hydrate",
    hint: "Drink water",
    color: "#3b82f6",
  },
  {
    id: "read",
    glyph: "✦",
    name: "Read",
    hint: "10 pages, anywhere",
    color: "#a855f7",
  },
  {
    id: "meditate",
    glyph: "◉",
    name: "Sit",
    hint: "Breathe, observe",
    color: "#22c55e",
  },
  {
    id: "rest",
    glyph: "◐",
    name: "Sleep early",
    hint: "Lights out by 11",
    color: "#ec4899",
  },
  {
    id: "sunlight",
    glyph: "☀",
    name: "Sunlight",
    hint: "10 min outside",
    color: "#f59e0b",
  },
];

// ─── Component ──────────────────────────────────────────────────────────────

type Step = 0 | 1 | 2 | 3;
const TOTAL_STEPS = 4;

export default function OnboardingScreen() {
  const { state } = useStageholder();
  const { user } = useUser();
  const router = useRouter();
  const haptic = useHaptic();
  const toast = useToast();
  const updateTargets = useUpdateTargets();
  const createHabit = useCreateHabit();

  // Guard: this screen requires an authenticated session. If the gate in
  // authed/_layout.tsx fires us here AFTER auth, this branch never executes.
  // Direct-deep-link to /onboarding while unauthenticated → /sign-in.
  if (state.status === "loading") {
    return (
      <YStack flex={1} bg="$background" items="center" justify="center">
        <Spinner size="large" />
      </YStack>
    );
  }
  if (state.status !== "authenticated") {
    return <Redirect href="/sign-in" />;
  }

  return (
    <OnboardingFlow
      sub={state.data.sub}
      firstName={user?.name?.split(" ")[0] ?? null}
      onComplete={async (selection) => {
        // Best-effort persist of targets + seed habits. If anything fails
        // we still flip the onboarded flag and let the user retry from
        // Profile / Habits — the worst outcome is "you'll need to set
        // targets on the profile screen", not a stuck flow.
        try {
          await updateTargets.mutateAsync({
            todoTargetDaily: selection.todoTarget,
            journalTargetDailyWords: selection.wordTarget,
          });
        } catch (e) {
          toast.show({
            title: "Targets saved locally",
            message:
              extractServerMessage(e) ?? "We'll retry once you're online.",
            intent: "warning",
          });
        }

        const seeds = HABIT_SEEDS.filter((h) =>
          selection.habitIds.includes(h.id),
        );
        await Promise.allSettled(
          seeds.map((h) =>
            createHabit.mutateAsync({
              name: h.name,
              color: h.color,
              frequency: "daily",
            }),
          ),
        );

        await markOnboarded(state.data.sub);
        router.replace("/");
      }}
    />
  );
}

// ─── Flow controller ────────────────────────────────────────────────────────

type Selection = {
  todoTarget: number;
  wordTarget: number;
  habitIds: string[];
};

function OnboardingFlow({
  sub: _sub,
  firstName,
  onComplete,
}: {
  sub: string;
  firstName: string | null;
  onComplete: (s: Selection) => Promise<void>;
}) {
  const haptic = useHaptic();
  const [step, setStep] = useState<Step>(0);
  const [todoTarget, setTodoTarget] = useState<number>(5);
  const [wordTarget, setWordTarget] = useState<number>(150);
  const [habitIds, setHabitIds] = useState<string[]>([]);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function next() {
    haptic.selection();
    setStep((s) => Math.min(3, s + 1) as Step);
  }
  function back() {
    haptic.selection();
    setStep((s) => Math.max(0, s - 1) as Step);
  }
  function toggleHabit(id: string) {
    haptic.selection();
    setHabitIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  }
  async function finish() {
    setError(null);
    setFinishing(true);
    haptic.notification("success");
    try {
      await onComplete({ todoTarget, wordTarget, habitIds });
    } catch (e) {
      setError((e as Error).message ?? "Something went wrong.");
      setFinishing(false);
    }
  }

  const showSkip = step === 2; // habit seed is the only optional step

  return (
    <YStack flex={1} bg="$background">
      <SafeAreaView
        style={{ flex: 1 }}
        edges={["top", "left", "right", "bottom"]}
      >
        <YStack flex={1} px="$5" pt="$3" pb="$4">
          {/* ── Top chrome: brand mark + step gauge ─────────────────────── */}
          <XStack items="center" justify="space-between" pb="$4">
            <Paragraph
              fontFamily="$mono"
              fontSize={11}
              letterSpacing={2.4}
              textTransform="uppercase"
              color="$color11"
              fontWeight="700"
            >
              Meridian
            </Paragraph>
            {showSkip ? (
              <Pressable onPress={next} accessibilityRole="button">
                <Text
                  fontFamily="$mono"
                  fontSize={11}
                  letterSpacing={1.6}
                  textTransform="uppercase"
                  color="$color11"
                  fontWeight="600"
                >
                  Skip →
                </Text>
              </Pressable>
            ) : null}
          </XStack>

          <StepGauge step={step} total={TOTAL_STEPS} />

          <Paragraph
            fontFamily="$mono"
            fontSize={10}
            letterSpacing={2}
            textTransform="uppercase"
            color="$color11"
            pt="$3"
            fontWeight="700"
          >
            {`Step ${String(step + 1).padStart(2, "0")} of ${TOTAL_STEPS}`}
          </Paragraph>

          {/* ── Step body ───────────────────────────────────────────────── */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1, paddingTop: 8 }}
            showsVerticalScrollIndicator={false}
          >
            {step === 0 ? (
              <StepWelcome firstName={firstName} />
            ) : step === 1 ? (
              <StepTargets
                todoTarget={todoTarget}
                setTodoTarget={setTodoTarget}
                wordTarget={wordTarget}
                setWordTarget={setWordTarget}
                onHaptic={() => haptic.selection()}
              />
            ) : step === 2 ? (
              <StepHabits selected={habitIds} onToggle={toggleHabit} />
            ) : (
              <StepReady
                firstName={firstName}
                todoTarget={todoTarget}
                wordTarget={wordTarget}
                habitCount={habitIds.length}
              />
            )}

            {error ? (
              <Banner intent="danger" mt="$4">
                <Banner.Title>Couldn't finish setup</Banner.Title>
                <Banner.Description>{error}</Banner.Description>
              </Banner>
            ) : null}
          </ScrollView>

          {/* ── Footer ──────────────────────────────────────────────────── */}
          {/* Stack the primary CTA and secondary "Back" link vertically so
              Continue stays full-width and visually centered on every step.
              The previous side-by-side layout left an invisible ghost Back
              button claiming the left third on steps 1+, making Continue
              look right-shifted. */}
          <YStack gap="$2" pt="$3">
            {step < 3 ? (
              <Button
                intent="primary"
                size="$5"
                onPress={next}
                width={"100%" as never}
              >
                {step === 0 ? "Begin" : "Continue"}
              </Button>
            ) : (
              <Button
                intent="primary"
                size="$5"
                onPress={finish}
                disabled={finishing}
                width={"100%" as never}
              >
                {finishing ? "Igniting…" : "Enter Meridian"}
              </Button>
            )}
            {step > 0 && !finishing ? (
              <Button intent="ghost" size="$3" onPress={back} self="center">
                Back
              </Button>
            ) : null}
          </YStack>
        </YStack>
      </SafeAreaView>
    </YStack>
  );
}

// ─── Step gauge ─────────────────────────────────────────────────────────────
// Four short horizontal bars at the top. Completed bars are journal-yellow,
// the current is habit-orange, upcoming are dim. Echoes the LevelProgressCard
// pyrometer aesthetic — visual continuity with the dashboard.

function StepGauge({ step, total }: { step: number; total: number }) {
  return (
    <XStack gap="$2">
      {Array.from({ length: total }).map((_, i) => {
        const done = i < step;
        const current = i === step;
        const bg = done
          ? IGNITION.journal.base
          : current
            ? IGNITION.habit.base
            : "rgba(255, 255, 255, 0.08)";
        return (
          <YStack
            key={i}
            flex={1}
            height={3}
            rounded={2}
            bg={bg as never}
            style={
              current
                ? {
                    shadowColor: IGNITION.habit.base,
                    shadowOpacity: 0.7,
                    shadowRadius: 6,
                    shadowOffset: { width: 0, height: 0 },
                  }
                : undefined
            }
          />
        );
      })}
    </XStack>
  );
}

// ─── Step 1 — Welcome ───────────────────────────────────────────────────────

function StepWelcome({ firstName }: { firstName: string | null }) {
  // Sample rings rendered at 100% on all three — a static "ignited" state
  // that previews the daily target visualization.
  const rings = [
    {
      value: 1,
      max: 1,
      color: IGNITION.journal.base,
      trackColor: IGNITION.journal.track,
      label: "Journal",
    },
    {
      value: 1,
      max: 1,
      color: IGNITION.habit.base,
      trackColor: IGNITION.habit.track,
      label: "Habits",
    },
    {
      value: 1,
      max: 1,
      color: IGNITION.todo.base,
      trackColor: IGNITION.todo.track,
      label: "Todos",
    },
  ];

  return (
    <YStack flex={1} justify="center" gap="$6" pt="$4">
      <YStack items="center" gap="$5">
        <ActivityRings size={180} rings={rings}>
          <Text fontSize={36}>🔥</Text>
        </ActivityRings>
      </YStack>

      <YStack gap="$3">
        <H1 color="$color12" lineHeight="$11">
          Light, kept{firstName ? `, ${firstName}` : ""}.
        </H1>
        <Paragraph fontSize="$3" color="$color11" lineHeight="$3">
          Meridian measures the things that move you forward in a single
          currency — light, earned by showing up. Habits checked, todos done,
          words written: each one feeds the flame.
        </Paragraph>
        <Paragraph fontSize="$2" color="$color10" lineHeight="$2" pt="$1">
          The three rings above are the anatomy of a flame — yellow outer for
          journaling, orange for habits, red core for todos. Filling them all is
          what we call a perfect day.
        </Paragraph>
      </YStack>
    </YStack>
  );
}

// ─── Step 2 — Daily rhythm / targets ────────────────────────────────────────

function StepTargets({
  todoTarget,
  setTodoTarget,
  wordTarget,
  setWordTarget,
  onHaptic,
}: {
  todoTarget: number;
  setTodoTarget: (n: number) => void;
  wordTarget: number;
  setWordTarget: (n: number) => void;
  onHaptic: () => void;
}) {
  return (
    <YStack gap="$5" pt="$2">
      <YStack gap="$2">
        <H2 color="$color12">Set your daily rhythm.</H2>
        <Paragraph fontSize="$3" color="$color11" lineHeight="$3">
          These power the activity rings on the dashboard. You can change them
          any time from Profile.
        </Paragraph>
      </YStack>

      <PresetGroup
        label="Todos per day"
        accent={IGNITION.todo.base}
        accentGlow={IGNITION.todo.glow}
        options={TODO_PRESETS.map((p) => ({
          ...p,
          display: String(p.value),
        }))}
        value={todoTarget}
        onPick={(v) => {
          onHaptic();
          setTodoTarget(v);
        }}
      />

      <PresetGroup
        label="Journal words per day"
        accent={IGNITION.journal.base}
        accentGlow={IGNITION.journal.glow}
        options={WORD_PRESETS.map((p) => ({
          ...p,
          display: String(p.value),
        }))}
        value={wordTarget}
        onPick={(v) => {
          onHaptic();
          setWordTarget(v);
        }}
      />

      <Paragraph fontSize="$1" color="$color10" pt="$2" lineHeight="$1">
        Most people start at{" "}
        <Text color="$color11" fontWeight="600">
          5 todos
        </Text>{" "}
        and{" "}
        <Text color="$color11" fontWeight="600">
          150 words
        </Text>
        . Aim for a target you can hit on a hard day, not a great one.
      </Paragraph>
    </YStack>
  );
}

function PresetGroup({
  label,
  accent,
  accentGlow,
  options,
  value,
  onPick,
}: {
  label: string;
  accent: string;
  accentGlow: string;
  options: ReadonlyArray<{ value: number; label: string; display: string }>;
  value: number;
  onPick: (v: number) => void;
}) {
  return (
    <YStack gap="$2.5">
      <Paragraph
        fontFamily="$mono"
        fontSize={10}
        letterSpacing={1.8}
        textTransform="uppercase"
        color="$color11"
        fontWeight="700"
      >
        {label}
      </Paragraph>
      <XStack gap="$2" flexWrap="wrap">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onPick(opt.value)}
              style={{ flexBasis: "30%", flexGrow: 1, minWidth: 90 }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <YStack
                px="$3"
                py="$2.5"
                rounded="$3"
                bg={active ? (accent as never) : ("$color2" as never)}
                borderWidth={1}
                borderColor={(active ? accent : "$color6") as never}
                items="center"
                gap={2}
                style={
                  active
                    ? {
                        shadowColor: accentGlow,
                        shadowOpacity: 0.9,
                        shadowRadius: 10,
                        shadowOffset: { width: 0, height: 0 },
                      }
                    : undefined
                }
              >
                <Text
                  fontFamily="$mono"
                  fontSize="$5"
                  fontWeight="800"
                  color={active ? "#0a0a0a" : ("$color12" as never)}
                >
                  {opt.display}
                </Text>
                <Text
                  fontSize={9}
                  letterSpacing={1.4}
                  textTransform="uppercase"
                  fontWeight="700"
                  color={active ? "rgba(10,10,10,0.7)" : ("$color11" as never)}
                >
                  {opt.label}
                </Text>
              </YStack>
            </Pressable>
          );
        })}
      </XStack>
    </YStack>
  );
}

// ─── Step 3 — Habit seed ────────────────────────────────────────────────────

function StepHabits({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <YStack gap="$5" pt="$2">
      <YStack gap="$2">
        <H2 color="$color12">Pick what you're igniting.</H2>
        <Paragraph fontSize="$3" color="$color11" lineHeight="$3">
          Start with one or two. You can add more — or rename these — any time
          from the Habits tab. Skip if you'd rather start blank.
        </Paragraph>
      </YStack>

      <XStack flexWrap="wrap" gap="$3">
        {HABIT_SEEDS.map((h) => {
          const active = selected.includes(h.id);
          return (
            <Pressable
              key={h.id}
              onPress={() => onToggle(h.id)}
              style={{
                width: "47%",
                flexGrow: 1,
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <YStack
                p="$3.5"
                rounded="$4"
                bg={active ? (`${h.color}1f` as never) : ("$color2" as never)}
                borderWidth={1.5}
                borderColor={(active ? h.color : "$color6") as never}
                gap="$2"
                minHeight={108}
                justify="space-between"
                style={
                  active
                    ? {
                        shadowColor: h.color,
                        shadowOpacity: 0.55,
                        shadowRadius: 10,
                        shadowOffset: { width: 0, height: 0 },
                      }
                    : undefined
                }
              >
                <XStack items="center" justify="space-between">
                  <YStack
                    width={28}
                    height={28}
                    rounded={14}
                    items="center"
                    justify="center"
                    bg={(active ? h.color : `${h.color}33`) as never}
                  >
                    <Text
                      fontSize={16}
                      color={active ? "white" : (h.color as never)}
                    >
                      {h.glyph}
                    </Text>
                  </YStack>
                  {active ? (
                    <Text
                      fontFamily="$mono"
                      fontSize={11}
                      color={h.color as never}
                      fontWeight="800"
                    >
                      ✓
                    </Text>
                  ) : null}
                </XStack>
                <YStack gap={2}>
                  <Text fontSize="$4" fontWeight="700" color="$color12">
                    {h.name}
                  </Text>
                  <Paragraph fontSize="$1" color="$color11" lineHeight="$1">
                    {h.hint}
                  </Paragraph>
                </YStack>
              </YStack>
            </Pressable>
          );
        })}
      </XStack>

      <Paragraph fontSize="$1" color="$color10" lineHeight="$1">
        {selected.length === 0
          ? "No habits selected — that's fine. Tap Skip or Continue to start blank."
          : `${selected.length} selected. Each will be created as a daily habit.`}
      </Paragraph>
    </YStack>
  );
}

// ─── Step 4 — Ready ─────────────────────────────────────────────────────────

function StepReady({
  firstName,
  todoTarget,
  wordTarget,
  habitCount,
}: {
  firstName: string | null;
  todoTarget: number;
  wordTarget: number;
  habitCount: number;
}) {
  return (
    <YStack gap="$5" pt="$2">
      <YStack gap="$2">
        <H1 color="$color12" lineHeight="$11">
          You're set{firstName ? `, ${firstName}` : ""}.
        </H1>
        <Paragraph fontSize="$3" color="$color11" lineHeight="$3">
          Every check-in, todo done, and word written earns light. Your tier
          climbs as your total light grows — there are ten in all, beginning
          tonight at{" "}
          <Text color="$color12" fontWeight="700">
            Stargazer
          </Text>
          .
        </Paragraph>
      </YStack>

      {/* Receipt of selections */}
      <YStack
        p="$4"
        rounded="$4"
        bg="$color2"
        borderWidth={1}
        borderColor="$color6"
        gap="$3"
      >
        <Paragraph
          fontFamily="$mono"
          fontSize={10}
          letterSpacing={1.8}
          textTransform="uppercase"
          color="$color11"
          fontWeight="700"
        >
          Your starting setup
        </Paragraph>
        <YStack gap="$2">
          <ReceiptLine
            color={IGNITION.todo.base}
            label="Todos / day"
            value={String(todoTarget)}
          />
          <ReceiptLine
            color={IGNITION.habit.base}
            label="Starter habits"
            value={
              habitCount === 0
                ? "None — start blank"
                : `${habitCount} ${habitCount === 1 ? "habit" : "habits"}, daily`
            }
          />
          <ReceiptLine
            color={IGNITION.journal.base}
            label="Journal words / day"
            value={String(wordTarget)}
          />
        </YStack>
      </YStack>

      <Paragraph fontSize="$1" color="$color10" lineHeight="$1">
        You can tune any of this on the Profile tab. The fire is yours to keep.
      </Paragraph>
    </YStack>
  );
}

function ReceiptLine({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <XStack items="center" gap="$3">
      <YStack
        width={8}
        height={8}
        rounded={4}
        bg={color as never}
        style={{
          shadowColor: color,
          shadowOpacity: 0.8,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 0 },
        }}
      />
      <Text fontSize="$2" color="$color11" flex={1}>
        {label}
      </Text>
      <Text fontFamily="$mono" fontSize="$2" color="$color12" fontWeight="700">
        {value}
      </Text>
    </XStack>
  );
}
