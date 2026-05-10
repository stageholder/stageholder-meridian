// apps/mobile/components/journal/EntryEditor.tsx
//
// One journal entry's editor: mood + body + tags, with autosave running
// silently in the background. Crossing the daily word target fires a
// toast + haptic.notification('success') — the only visible "you did it"
// celebration in this screen.
//
// We use TextArea (plain) instead of a rich-text editor — that's a deferred
// design exercise (cross-platform editor, content model). Plain text is fine
// for the pattern we want to expose.

import {
  MoodPicker,
  Paragraph,
  Progress,
  Text,
  TagInput,
  TextArea,
  XStack,
  YStack,
  useAutosave,
  useHaptic,
  useToast,
} from "@stageholder/ui";
import { useEffect, useRef, useState } from "react";

import { useJournal } from "@/lib/stores/journal";
import { countWords, type JournalEntry, type Mood } from "@/lib/types";

export type EntryEditorProps = {
  entry: JournalEntry;
  /** Word target across all entries for the day — used for the celebration. */
  dailyTarget: number;
  /** Total words across all entries on the same day, NOT just this one. */
  dayTotalWords: number;
};

export function EntryEditor({
  entry,
  dailyTarget,
  dayTotalWords,
}: EntryEditorProps) {
  const { update } = useJournal();
  const haptic = useHaptic();
  const toast = useToast();

  const [body, setBody] = useState(entry.body);
  const [mood, setMood] = useState<Mood | undefined>(entry.mood);
  const [tags, setTags] = useState<string[]>(entry.tags);

  const wordCount = countWords(body);
  const totalForDay = dayTotalWords - countWords(entry.body) + wordCount;
  const percentToTarget =
    dailyTarget > 0 ? Math.min(100, (totalForDay / dailyTarget) * 100) : 0;

  // Track whether we've already celebrated for today's target — don't keep
  // firing the toast if the user keeps typing past it.
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
  }, [totalForDay, dailyTarget, dayTotalWords, haptic, toast]);

  // Autosave the whole entry when any field changes. We pass `entry.id` in
  // a synthetic value so the hook re-arms on entry switches without firing
  // a save just for the swap.
  const watched = { body, mood, tags, _id: entry.id };
  useAutosave(watched, {
    delay: 500,
    onSave: async (v) => {
      // No-op if the entry was deleted while the save was in flight.
      update(entry.id, { body: v.body, mood: v.mood, tags: v.tags });
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
          onChange={(v) => setMood((v as Mood) ?? undefined)}
          // 5 small bubbles + labels would be too dense for mobile inline.
          showLabels={false}
        />
        <Paragraph fontSize="$1" color="$color11">
          {wordCount} word{wordCount === 1 ? "" : "s"}
        </Paragraph>
      </XStack>

      <TextArea
        value={body}
        onChangeText={setBody}
        placeholder="What's on your mind?"
        size="$4"
        minH={140 as never}
        // Native autoCapitalize/autoCorrect feel right for journaling.
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
    </YStack>
  );
}

/* The body text input is just a TextArea here. Mobile-rich-text editing
   is a separate design exercise (TipTap on web vs Lexical on native), and
   shipping a half-baked rich editor now costs more than it gains. The
   plain TextArea is honest about its scope and easy to swap later. */
function _RichTextNote() {
  return (
    <Text>
      Plain TextArea for v1. Lexical on RN or react-native-pell-richeditor can
      swap in later — the EntryEditor consumer API stays the same.
    </Text>
  );
}
void _RichTextNote;
