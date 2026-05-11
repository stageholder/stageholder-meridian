// apps/mobile/components/journal/EntryEditor.tsx
//
// One journal entry's editor: mood + body + tags. useAutosave fires
// useUpdateJournal after 500ms of typing-quiet — the EntryEditor stays
// honest about its scope (plain TextArea, no rich-text editor; that's
// deferred to a future round with a proper cross-platform decision).
//
// Crossing the daily word target fires the only celebration in this
// screen — a toast + success haptic, exactly once per day per entry.

import {
  MoodPicker,
  Paragraph,
  Progress,
  TagInput,
  Text,
  TextArea,
  XStack,
  YStack,
  useAutosave,
  useHaptic,
  useToast,
} from "@stageholder/ui";
import type { Journal } from "@repo/core/types";
import { useEffect, useRef, useState } from "react";

import { useUpdateJournal } from "@/lib/api";

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

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export type EntryEditorProps = {
  entry: Journal;
  /** Daily word target — drives the target-hit celebration. */
  dailyTarget: number;
  /** Total words across all entries on the same day (server's `wordCount`s summed). */
  dayTotalWords: number;
};

export function EntryEditor({
  entry,
  dailyTarget,
  dayTotalWords,
}: EntryEditorProps) {
  const update = useUpdateJournal();
  const haptic = useHaptic();
  const toast = useToast();

  const [content, setContent] = useState(entry.content);
  const [mood, setMood] = useState<number | undefined>(entry.mood ?? undefined);
  const [tags, setTags] = useState<string[]>(normalizeTags(entry.tags));

  const wordCount = countWords(content);
  // Project today's total: subtract the server's wordCount for this entry,
  // add the live local count. Lets the progress bar move smoothly while
  // the user types instead of jumping when the autosave settles.
  const totalForDay = dayTotalWords - (entry.wordCount ?? 0) + wordCount;
  const percentToTarget =
    dailyTarget > 0 ? Math.min(100, (totalForDay / dailyTarget) * 100) : 0;

  // Target celebration — fires once per editor session when crossing up.
  const celebratedRef = useRef(false);
  useEffect(() => {
    if (
      !celebratedRef.current &&
      dailyTarget > 0 &&
      totalForDay >= dailyTarget &&
      dayTotalWords < dailyTarget
    ) {
      celebratedRef.current = true;
      haptic.notification("success");
      toast.show({
        title: `${dailyTarget} words today ✦`,
        message: "You hit your writing target.",
        intent: "success",
      });
    }
  }, [totalForDay, dayTotalWords, dailyTarget, haptic, toast]);

  // Autosave: id changes when the user switches entries; including `_id`
  // in the watched value forces useAutosave to re-arm without firing
  // a save just for the entry swap.
  const watched = { content, mood, tags, _id: entry.id };
  useAutosave(watched, {
    delay: 500,
    onSave: async (v) => {
      await update.mutateAsync({
        id: entry.id,
        patch: { content: v.content, mood: v.mood, tags: v.tags },
      });
    },
  });

  return (
    <YStack
      gap="$3"
      p="$3"
      rounded="$3"
      bg="$color2"
      borderWidth={1}
      borderColor="$color6"
    >
      <XStack items="center" justify="space-between">
        <MoodPicker
          value={mood ?? null}
          onChange={(v) => setMood((v as number | null) ?? undefined)}
          showLabels={false}
        />
        <Paragraph fontSize="$1" color="$color11">
          {wordCount} word{wordCount === 1 ? "" : "s"}
        </Paragraph>
      </XStack>

      <TextArea
        value={content}
        onChangeText={setContent}
        placeholder="What's on your mind?"
        size="$4"
        minH={140 as never}
        autoCapitalize="sentences"
        autoCorrect
      />

      <TagInput
        value={tags}
        onChange={setTags}
        placeholder="Add a tag…"
        maxTags={6}
      />

      {dailyTarget > 0 ? (
        <YStack gap="$1">
          <XStack justify="space-between">
            <Paragraph fontSize="$1" color="$color11">
              Today's target
            </Paragraph>
            <Paragraph fontSize="$1" color="$color11">
              {totalForDay} / {dailyTarget}
            </Paragraph>
          </XStack>
          <Progress value={percentToTarget}>
            <Progress.Indicator />
          </Progress>
        </YStack>
      ) : null}

      {update.error ? (
        <Paragraph fontSize="$1" color="$red11">
          Save failed — your text is safe locally. Will retry on next change.
        </Paragraph>
      ) : null}
    </YStack>
  );
}
