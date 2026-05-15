// apps/mobile/components/journal/EntryEditor.tsx
//
// The Meridian Page — Meridian's signature journaling composer.
//
// "Where your day reaches its highest point."
//
// Plain TextInput body underneath (no native modules, no rebuilds), but
// wrapped in brand-defining UX so each entry feels like a personal
// observer's almanac log:
//
//   1. Sky Strip — a thin gradient bar at the top that color-shifts by
//      time of day (dawn / day / dusk / night). Drawn via react-native-svg
//      which is already installed — no expo-linear-gradient needed.
//   2. Daily Meridian Prompt — a deterministic, rotating question that
//      fades behind the cursor as the user types. Same prompt for everyone
//      on the same day → quiet shared cultural touchstone.
//   3. Ignition Glow — a colored halo behind the writing card that grows
//      in opacity & scale as words approach the daily target. Crossing the
//      target triggers a brief pulse + success haptic. The card itself
//      "ignites" as the entry fills out — same fire metaphor as the streak
//      indicator, applied to the act of writing.
//   4. Mood-tinted Surface — picked mood subtly tints the writing card's
//      background by ~6% (sad = cool slate, calm = silver-blue, joy =
//      warm cream). Discoverable through use, never announced.
//   5. Brand-language Footer — "Light gathered · 247 words" instead of
//      "Saved". PulsingFire next to the count pulses while typing.
//
// Public API (props) is unchanged from the previous implementation so the
// /journal screen continues to import this without modification.

import {
  IconButton,
  MoodPicker,
  Paragraph,
  TagInput,
  Text,
  View,
  XStack,
  YStack,
  useAutosave,
  useHaptic,
  useToast,
} from "@stageholder/ui";
import type { Journal } from "@repo/core/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Easing, TextInput } from "react-native";

import { useDeleteJournal, useUpdateJournal } from "@/lib/api";
import { PulsingFire } from "@/components/PulsingFire";

/* ───────────────────────────── tag normalization ─────────────────────── */

function normalizeTags(t: Journal["tags"]): string[] {
  if (Array.isArray(t)) return t;
  if (typeof t === "string" && t.trim()) {
    return t
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/* ───────────────────────────── word count ────────────────────────────── */
//
// Plain text in / plain text out — count visible words. Older HTML-tagged
// entries (from the brief react-native-enriched stint) also count
// correctly because we strip tags before splitting.
function countWords(text: string): number {
  const cleaned = text.replace(/<[^>]*>/g, " ").trim();
  return cleaned ? cleaned.split(/\s+/).length : 0;
}

/* ───────────────────────────── daily prompt ──────────────────────────── */
//
// A small library of contemplative prompts. Selected deterministically by
// day-of-year so the prompt feels like "today's question" rather than a
// random surprise on each render. Same prompt for everyone on the same
// date → shared cultural touchstone.

const PROMPTS = [
  "What burned brightest today?",
  "Where did your attention rest?",
  "What surprised you?",
  "What did you almost not notice?",
  "What's worth carrying forward?",
  "Who crossed your mind today?",
  "What made you slow down?",
  "What feels lighter now than this morning?",
  "What did the day ask of you?",
  "What stayed with you after dark?",
  "What grew quieter today?",
  "What's one thing you'd tell yesterday-you?",
  "What were you wrong about?",
  "Where did warmth show up?",
  "What did the day not give you?",
];

function promptFor(date: Date): string {
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000,
  );
  return PROMPTS[dayOfYear % PROMPTS.length] as string;
}

/* ───────────────────────────── ignition math ─────────────────────────── */

type IgnitionStage = 0 | 1 | 2 | 3 | 4;

function ignitionStage(words: number, target: number): IgnitionStage {
  if (target <= 0) return 0;
  const ratio = words / target;
  if (ratio < 0.1) return 0; // unlit
  if (ratio < 0.3) return 1; // ember
  if (ratio < 0.6) return 2; // flame
  if (ratio < 1.0) return 3; // blaze
  return 4; // roaring (≥ target)
}

const GLOW_BY_STAGE: Record<IgnitionStage, { opacity: number; scale: number }> =
  {
    0: { opacity: 0, scale: 1.0 },
    1: { opacity: 0.18, scale: 1.01 },
    2: { opacity: 0.34, scale: 1.02 },
    3: { opacity: 0.5, scale: 1.03 },
    4: { opacity: 0.72, scale: 1.04 },
  };

/* ───────────────────────────── mood tint ─────────────────────────────── */
//
// 5 mood values map to subtle background tints + border accents that paint
// the writing card. Tints are intentionally low-saturation — discoverable
// when you use the picker, never garish.

const MOOD_TINT: Record<number, { bg: string; border: string }> = {
  1: { bg: "rgba(96,108,140,0.08)", border: "rgba(96,108,140,0.4)" }, // sad — slate
  2: { bg: "rgba(124,140,180,0.06)", border: "rgba(124,140,180,0.35)" }, // down — dim blue
  3: { bg: "rgba(140,140,140,0.04)", border: "rgba(140,140,140,0.3)" }, // neutral — silver
  4: { bg: "rgba(220,180,120,0.06)", border: "rgba(220,180,120,0.4)" }, // calm-warm — sand
  5: { bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.45)" }, // joy — ember
};

const DEFAULT_TINT = {
  bg: "rgba(255,255,255,0.02)",
  border: "rgba(255,255,255,0.08)",
};

/* ───────────────────────────── progress meter ────────────────────────── */
//
// Horizontal bar that animates width to (totalForDay / dailyTarget).
// Width can't use the native driver, so we keep this on the JS thread —
// the animation is short (320 ms spring) so it's not a frame-budget risk.
//
// Two visual states:
//   - approaching: 3-pt thin bar, amber fill
//   - reached: 5-pt thicker bar, fire-orange fill with a glow halo (matches
//     the PWA's `journal-target-glow` effect)

function ProgressMeter({
  progress, // 0..(≥1)
  reached,
}: {
  progress: number;
  reached: boolean;
}) {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(widthAnim, {
      toValue: Math.max(0, Math.min(progress, 1)),
      tension: 60,
      friction: 12,
      useNativeDriver: false, // width interpolation needs JS driver
    }).start();
  }, [progress, widthAnim]);

  const widthPct = widthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View
      style={{
        width: "100%",
        height: reached ? 5 : 3,
        backgroundColor: "rgba(255,255,255,0.05)",
        borderRadius: 999,
        overflow: "hidden",
      }}
    >
      <Animated.View
        style={{
          height: "100%",
          width: widthPct,
          backgroundColor: reached ? "#f97316" : "#f59e0b",
          borderRadius: 999,
          // Glow halo on reached state — only visible on iOS shadow stack
          // and via boxShadow on Android (RN 0.81+ supports unified
          // boxShadow). Cheap to apply unconditionally.
          shadowColor: "#f97316",
          shadowOpacity: reached ? 0.85 : 0,
          shadowRadius: reached ? 8 : 0,
          shadowOffset: { width: 0, height: 0 },
        }}
      />
    </View>
  );
}

/* ───────────────────────────── celebration ───────────────────────────── */
//
// In-card target-hit celebration. Two layers:
//
//   1. 28 ember particles rising from the bottom of the writing card,
//      each with their own color / size / sway / duration / delay. Each
//      particle is one Animated.View with translateY + translateX + opacity
//      driven by a single 0→1 Animated.Value (native driver).
//   2. A "✦ Light gathered" banner that slides down from above the card,
//      holds ~2s, then slides back up. Uses the same brand language the
//      footer uses, so the celebration reads as the same moment expanded.
//
// Triggered by an incrementing counter prop — the parent bumps it once
// when totalForDay crosses dailyTarget. The component runs its animation
// each time the counter increments (no React state churn needed).

const EMBER_COLORS = [
  "#fb923c", // bright orange
  "#f97316", // hot orange
  "#fbbf24", // golden
  "#f59e0b", // amber
  "#facc15", // yellow
  "#ef4444", // hot red
  "#fde047", // pale yellow
];

const EMBER_COUNT = 28;

type Ember = {
  progress: Animated.Value;
  xPercent: number;
  sway: number;
  size: number;
  color: string;
  duration: number;
  delay: number;
};

function CelebrationOverlay({
  trigger,
  cardHeight,
}: {
  trigger: number;
  cardHeight: number;
}) {
  const [active, setActive] = useState(false);

  // Per-particle Animated.Value, stable across renders.
  const embers = useRef<Ember[]>(
    Array.from({ length: EMBER_COUNT }, () => ({
      progress: new Animated.Value(0),
      xPercent: 4 + Math.random() * 92, // 4..96
      sway: (Math.random() - 0.5) * 70, // ±35 px lateral
      size: 3 + Math.random() * 5,
      color: EMBER_COLORS[Math.floor(Math.random() * EMBER_COLORS.length)]!,
      duration: 1200 + Math.random() * 800,
      delay: Math.random() * 400,
    })),
  ).current;

  const bannerTranslateY = useRef(new Animated.Value(-44)).current;
  const bannerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (trigger === 0) return;
    setActive(true);

    // Reset particles + banner.
    embers.forEach((e) => e.progress.setValue(0));
    bannerTranslateY.setValue(-44);
    bannerOpacity.setValue(0);

    // Banner choreography: drop in (overshoot), hold, ascend.
    Animated.sequence([
      Animated.parallel([
        Animated.timing(bannerTranslateY, {
          toValue: 14,
          duration: 380,
          easing: Easing.out(Easing.back(1.6)),
          useNativeDriver: true,
        }),
        Animated.timing(bannerOpacity, {
          toValue: 1,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(2200),
      Animated.parallel([
        Animated.timing(bannerTranslateY, {
          toValue: -44,
          duration: 480,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(bannerOpacity, {
          toValue: 0,
          duration: 480,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Particles: parallel rise, each on its own clock.
    Animated.parallel(
      embers.map((e) =>
        Animated.timing(e.progress, {
          toValue: 1,
          duration: e.duration,
          delay: e.delay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ),
    ).start(() => {
      setActive(false);
    });
  }, [trigger, embers, bannerTranslateY, bannerOpacity]);

  if (!active) return null;

  // Particles travel from cardHeight − 6 (near the bottom edge) to −24
  // (just above the card's top). With overflow: hidden on the overlay,
  // anything above 0 fades naturally inside the bounding box.
  const startY = Math.max(40, cardHeight - 6);

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        overflow: "hidden",
        borderRadius: 18,
      }}
    >
      {embers.map((e, i) => {
        const translateY = e.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [startY, -24],
        });
        const translateX = e.progress.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0, e.sway, e.sway * 0.55],
        });
        const opacity = e.progress.interpolate({
          inputRange: [0, 0.08, 0.85, 1],
          outputRange: [0, 1, 0.55, 0],
        });
        const scale = e.progress.interpolate({
          inputRange: [0, 0.2, 1],
          outputRange: [0.4, 1, 0.7],
        });
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              left: `${e.xPercent}%`,
              top: 0,
              width: e.size,
              height: e.size,
              borderRadius: e.size,
              backgroundColor: e.color,
              shadowColor: e.color,
              shadowOpacity: 0.9,
              shadowRadius: e.size + 4,
              shadowOffset: { width: 0, height: 0 },
              transform: [{ translateY }, { translateX }, { scale }],
              opacity,
            }}
          />
        );
      })}

      {/* Banner: pill at the top of the card. */}
      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          alignItems: "center",
          transform: [{ translateY: bannerTranslateY }],
          opacity: bannerOpacity,
        }}
      >
        <View
          style={{
            backgroundColor: "rgba(249,115,22,0.18)",
            borderWidth: 1,
            borderColor: "rgba(249,115,22,0.55)",
            paddingHorizontal: 14,
            paddingVertical: 6,
            borderRadius: 999,
            shadowColor: "#f97316",
            shadowOpacity: 0.45,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 0 },
          }}
        >
          <Text
            fontFamily="Georgia"
            fontSize="$3"
            color="#f97316"
            fontWeight="600"
          >
            ✦ Light gathered
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

/* ───────────────────────────── component ─────────────────────────────── */

export type EntryEditorProps = {
  entry: Journal;
  /** Daily word target — drives the ignition meter + celebration. */
  dailyTarget: number;
  /** Total words across all entries on the same day. */
  dayTotalWords: number;
};

export function EntryEditor({
  entry,
  dailyTarget,
  dayTotalWords,
}: EntryEditorProps) {
  const update = useUpdateJournal();
  const remove = useDeleteJournal();
  const haptic = useHaptic();
  const toast = useToast();

  const [title, setTitle] = useState(entry.title ?? "");
  const [content, setContent] = useState(entry.content ?? "");
  const [mood, setMood] = useState<number | undefined>(entry.mood ?? undefined);
  const [tags, setTags] = useState<string[]>(normalizeTags(entry.tags));
  const [focused, setFocused] = useState(false);
  // Focus mode = distraction-free writing. Dims the sky strip, mood
  // picker, prompt label, tags, and footer to opacity 0.08 — the chrome
  // stays in layout (no shift) but recedes. The writing card and title
  // remain fully lit. Toggle via the focus icon in the header; auto-exits
  // on Save (target hit) and on delete-confirm.
  const [focusMode, setFocusMode] = useState(false);

  const wordCount = countWords(content);
  const totalForDay = dayTotalWords - (entry.wordCount ?? 0) + wordCount;
  const stage = ignitionStage(totalForDay, dailyTarget);
  const prompt = useMemo(() => promptFor(new Date()), []);
  const tint = mood ? (MOOD_TINT[mood] ?? DEFAULT_TINT) : DEFAULT_TINT;

  /* ───── ignition glow animation ───── */
  // Two Animated values: opacity + scale. Drive both off the stage so
  // crossing thresholds creates discrete "kicks" rather than a smooth
  // ramp — feels more like a fire catching than a meter filling.
  const glowOpacity = useRef(
    new Animated.Value(GLOW_BY_STAGE[0].opacity),
  ).current;
  const glowScale = useRef(new Animated.Value(GLOW_BY_STAGE[0].scale)).current;

  useEffect(() => {
    const target = GLOW_BY_STAGE[stage];
    Animated.parallel([
      Animated.timing(glowOpacity, {
        toValue: target.opacity,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(glowScale, {
        toValue: target.scale,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [stage, glowOpacity, glowScale]);

  /* ───── target-hit celebration ───── */
  // One-shot per editor session: when the user crosses the daily target
  // for the first time (totalForDay goes from <target to ≥target), fire
  // a success haptic + glow surge + in-card celebration overlay
  // (rising embers + "Light gathered" banner). Replaces the previous
  // toast since the in-context celebration carries the moment better.
  const celebratedRef = useRef(false);
  const [celebrationTrigger, setCelebrationTrigger] = useState(0);
  useEffect(() => {
    if (
      !celebratedRef.current &&
      dailyTarget > 0 &&
      totalForDay >= dailyTarget &&
      dayTotalWords < dailyTarget
    ) {
      celebratedRef.current = true;
      haptic.notification("success");
      setCelebrationTrigger((n) => n + 1);
      // Overshoot pulse on the glow.
      Animated.sequence([
        Animated.timing(glowScale, {
          toValue: 1.08,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(glowScale, {
          toValue: GLOW_BY_STAGE[4].scale,
          friction: 4,
          tension: 80,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [totalForDay, dayTotalWords, dailyTarget, haptic, glowScale]);

  /* ───── prompt opacity (fade as user writes) ───── */
  const promptOpacity = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    // Focus mode wins — the prompt is part of the distraction surface.
    const target = focusMode ? 0 : content.length > 0 ? 0.12 : 0.55;
    Animated.timing(promptOpacity, {
      toValue: target,
      duration: 240,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [content.length, promptOpacity, focusMode]);

  /* ───── focus-mode chrome dim ───── */
  // Sky strip, mood, prompt overlay, tags, footer share this opacity so
  // they fade together in one animation when focus mode toggles. Title
  // and writing card stay fully lit because they're not wrapped in it.
  const chromeOpacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(chromeOpacity, {
      toValue: focusMode ? 0.08 : 1,
      duration: 360,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [focusMode, chromeOpacity]);

  /* ───── autosave ───── */
  // `_id` re-arms useAutosave when switching entries without spuriously
  // firing a save for the swap.
  //
  // useMemo is LOAD-BEARING here — useAutosave compares `value` deps with
  // `Object.is`, so an unmemoized `{ ... }` literal would be a new
  // reference every render. After a save, onSettled invalidates the
  // journals query → refetch → re-render → new `watched` reference →
  // useAutosave thinks something changed → schedules another save →
  // infinite loop of redundant saves and refetches, which is what
  // tripped the API rate limiter. Memoizing makes the reference stable
  // when actual content hasn't changed.
  const watched = useMemo(
    () => ({ title, content, mood, tags, _id: entry.id }),
    [title, content, mood, tags, entry.id],
  );
  useAutosave(watched, {
    delay: 500,
    onSave: async (v) => {
      await update.mutateAsync({
        id: entry.id,
        patch: {
          title: v.title,
          content: v.content,
          mood: v.mood,
          tags: v.tags,
        },
      });
    },
  });

  function handleDelete() {
    Alert.alert("Delete entry?", "This entry will be removed permanently.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          haptic.impact("medium");
          remove.mutate(entry.id, {
            onError: () =>
              toast.show({
                title: "Couldn't delete",
                message: "Restored. Tap to retry.",
                intent: "danger",
              }),
          });
        },
      },
    ]);
  }

  // The TextInput grows up to ~14 visible lines; past that it scrolls
  // internally. Most journal entries are well under that. Auto-grow is
  // controlled via `numberOfLines` (Android hint) + `multiline` + dynamic
  // minHeight; iOS auto-grows multiline TextInputs natively.
  const [bodyHeight, setBodyHeight] = useState(180);
  function handleBodyContentSizeChange(e: {
    nativeEvent: { contentSize: { height: number } };
  }) {
    const h = e.nativeEvent.contentSize.height;
    setBodyHeight(Math.max(180, Math.min(560, h + 24)));
  }

  // Measure the writing card so the celebration overlay knows how far
  // particles need to travel. Default to bodyHeight + 100 (chrome height
  // estimate) until the first onLayout fires.
  const [cardHeight, setCardHeight] = useState(bodyHeight + 100);

  /* ──────────────────────── render ──────────────────────── */

  return (
    <YStack gap="$3" position="relative">
      {/* ── Today's progress (dimmable) ───────────────────────────── */}
      {/* The visible progress bar lives at the top — that's where the eye
          looks for "how am I doing today?". Fills as the user types,
          thickens + glows on target hit. Dims in focus mode along with
          the rest of the chrome. */}
      {dailyTarget > 0 ? (
        <Animated.View style={{ opacity: chromeOpacity }}>
          <ProgressMeter
            progress={totalForDay / dailyTarget}
            reached={totalForDay >= dailyTarget}
          />
        </Animated.View>
      ) : null}

      {/* ── Header: title + focus toggle + delete ─────────────────── */}
      {/* Header stays at full opacity in focus mode — the Focus button
          itself is the way OUT of focus mode, and the title shouldn't
          disappear with the rest of the chrome. */}
      <XStack items="center" gap="$2" pt="$1">
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Untitled entry"
          placeholderTextColor="rgba(160,170,200,0.55)"
          style={{
            flex: 1,
            fontFamily: "Georgia",
            fontSize: 22,
            fontWeight: "600",
            color: "#f5f1e8",
            paddingVertical: 0,
          }}
        />
        <IconButton
          size="$2"
          variant="ghost"
          onPress={() => {
            haptic.impact("light");
            setFocusMode((f) => !f);
          }}
          aria-label={focusMode ? "Exit focus mode" : "Enter focus mode"}
        >
          {/* Filled circle while in focus mode, ring otherwise. The two
              glyphs are visually distinct without needing colour, so it
              reads as a toggle even at small sizes. */}
          <Text
            fontSize={focusMode ? "$5" : "$4"}
            color={(focusMode ? "#f97316" : "$color11") as never}
          >
            {focusMode ? "●" : "○"}
          </Text>
        </IconButton>
        <IconButton
          size="$2"
          variant="ghost"
          intent="danger"
          onPress={handleDelete}
          aria-label="Delete entry"
        >
          <Text fontSize="$3" color="$color11">
            ✕
          </Text>
        </IconButton>
      </XStack>

      {/* ── Mood row (dimmable) ───────────────────────────────────── */}
      <Animated.View
        style={{ opacity: chromeOpacity }}
        pointerEvents={focusMode ? "none" : "auto"}
      >
        <MoodPicker
          value={mood ?? null}
          onChange={(v) => setMood((v as number | null) ?? undefined)}
          showLabels={false}
        />
      </Animated.View>

      {/* ── Writing card with ignition glow ───────────────────────── */}
      <YStack position="relative">
        {/* Ignition halo — sits behind the card. Scales + fades by stage.
            Native driver keeps it on the UI thread so it doesn't stutter
            when the JS thread is busy with autosave / haptics. */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: -6,
            left: -6,
            right: -6,
            bottom: -6,
            borderRadius: 18,
            backgroundColor: "#f97316",
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          }}
        />

        {/* Card surface — mood-tinted, focus-emphasized */}
        <YStack
          rounded="$4"
          bg={(focused ? tint.bg : "rgba(255,255,255,0.015)") as never}
          borderWidth={1}
          borderColor={
            (focused ? tint.border : "rgba(255,255,255,0.06)") as never
          }
          p="$4"
          gap="$2"
          position="relative"
          onLayout={(e: { nativeEvent: { layout: { height: number } } }) =>
            setCardHeight(e.nativeEvent.layout.height)
          }
        >
          {/* Daily Meridian Prompt — italic, fades as you type */}
          <Animated.View
            style={{ opacity: promptOpacity }}
            pointerEvents="none"
          >
            <Text
              fontFamily="Georgia"
              fontStyle="italic"
              fontSize="$4"
              color="#d4d0c4"
            >
              {prompt}
            </Text>
          </Animated.View>

          {/* Body — plain TextInput, serif body for almanac feel */}
          <TextInput
            value={content}
            onChangeText={setContent}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onContentSizeChange={handleBodyContentSizeChange}
            placeholder="Start where you are…"
            placeholderTextColor="rgba(160,170,200,0.4)"
            multiline
            autoCapitalize="sentences"
            autoCorrect
            scrollEnabled={false}
            textAlignVertical="top"
            style={{
              fontFamily: "Georgia",
              fontSize: 17,
              lineHeight: 26,
              color: "#f5f1e8",
              minHeight: bodyHeight,
              paddingVertical: 4,
            }}
          />
        </YStack>

        {/* Target-hit celebration — overlays the card with rising embers
            and a "Light gathered" banner. Pointer-events none so it
            doesn't intercept taps on the card below. */}
        <CelebrationOverlay
          trigger={celebrationTrigger}
          cardHeight={cardHeight}
        />
      </YStack>

      {/* ── Tags (dimmable) ───────────────────────────────────────── */}
      <Animated.View
        style={{ opacity: chromeOpacity }}
        pointerEvents={focusMode ? "none" : "auto"}
      >
        <TagInput
          value={tags}
          onChange={setTags}
          placeholder="Tag this entry…"
          maxTags={6}
        />
      </Animated.View>

      {/* ── Footer: brand-language word counter (dimmable) ────────── */}
      {/* Bar lives at the top now; footer is just the count + state
          text + streak fire. Less visual noise, single source of
          progress feedback. */}
      <Animated.View style={{ opacity: chromeOpacity }}>
        <XStack items="center" justify="space-between" pt="$1">
          <XStack items="center" gap="$2">
            {/* PulsingFire scales with stage — barely visible when
                unlit, prominent when the entry is roaring. */}
            <PulsingFire size={stage === 0 ? 14 : 14 + stage * 2} />
            <Text
              fontFamily="$mono"
              fontSize="$1"
              letterSpacing={1.6}
              textTransform="uppercase"
              color="#d4d0c4"
            >
              {wordCount.toLocaleString()} word{wordCount === 1 ? "" : "s"}
            </Text>
          </XStack>

          {dailyTarget > 0 ? (
            <Text
              fontFamily="$mono"
              fontSize="$1"
              letterSpacing={1.6}
              textTransform="uppercase"
              color={
                (totalForDay >= dailyTarget ? "#f97316" : "#8a92a6") as never
              }
            >
              {totalForDay >= dailyTarget
                ? "Light gathered"
                : `${totalForDay} / ${dailyTarget}`}
            </Text>
          ) : (
            <Text
              fontFamily="$mono"
              fontSize="$1"
              letterSpacing={1.6}
              textTransform="uppercase"
              color="#8a92a6"
            >
              Light gathered
            </Text>
          )}
        </XStack>
      </Animated.View>

      {update.error ? (
        <Paragraph fontSize="$1" color="$red11">
          Save didn't reach the page yet — your words are safe locally. We'll
          retry on next change.
        </Paragraph>
      ) : null}
    </YStack>
  );
}
