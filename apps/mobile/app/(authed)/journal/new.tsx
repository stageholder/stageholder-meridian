// apps/mobile/app/(authed)/journal/new.tsx
//
// Native journal CREATION — the counterpart of the PWA's
// apps/pwa/src/routes/_app/journal/new.tsx. Renders the SAME cross-platform
// JournalEditor (kit RichTextEditor → 10tap on native, TipTap on web) so the
// document is byte-compatible TipTap-JSON across both targets, then encrypts
// with the in-memory DEK before the POST (see useCreateJournal).
//
// Why a full-screen ROUTE (not the FormSheet pattern the habit/todo creators
// use): rich editing needs vertical room — the toolbar, the editor body, and
// the on-screen keyboard together fill the viewport. A bottom sheet would be
// cramped and the keyboard would cover the edit surface. The PWA reaches the
// same conclusion (journal/new is a standalone page, not a dialog), so this
// mirrors it. The route is registered with `href: null` in (authed)/_layout
// so it isn't a tab destination; the Journal tab stays lit via prefix match.
//
// Autosave (parity with the PWA): the local use-autosave port debounces 1s,
// POSTs once on the first non-empty change (then remembers the id for
// PATCHes), and flushes on unmount. The empty-draft guard means backing out
// without typing never creates an orphan entry. The header's Done button just
// returns to the list — persistence has already happened (or will via the
// pending debounce timer, which still fires after navigation).
//
// Encryption: the create mutation encrypts inline when a DEK is present. If
// encryption is SET UP but LOCKED (no DEK in memory), we can't encrypt — bounce
// the writer to the journal list, which owns the unlock flow.

import {
  Button,
  IconButton,
  MoodPicker,
  MOOD_DEFAULT_OPTIONS,
  QuickDatePicker,
  Sheet,
  TagInput,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import { JournalEditor } from "@repo/features/journal";
import type { RichTextEditorContent } from "@stageholder/ui";
import { countWordsFromContent } from "@repo/core/utils/text";
import { ChevronLeft, SmilePlus } from "@tamagui/lucide-icons-2";
// Bare tamagui Input for the title — no kit Frame chrome, matching the PWA's
// bare title field (kit Input wraps a bordered Frame whose focus ring can't be
// zeroed from call-site props).
import { Input as BareInput } from "tamagui";
import { KeyboardController } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  JournalTargetCelebration,
  JournalTargetProgress,
} from "@/components/journal-progress";
import { useJournals, useUserLight } from "@/lib/api";
import { useAutosave } from "@/lib/use-autosave";
import { useJournalCrypto } from "@/lib/journal-crypto";

/** Empty TipTap doc — the editor seeds from this for a fresh entry. */
// Typed as the kit's RichTextEditorContent (TipTap JSONContent) — this screen
// only ever holds JSON (10tap), never the legacy HTML string side of
// JournalContent, and the editor's `initialContent` requires the JSON shape.
const EMPTY_DOC: RichTextEditorContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

function localDateKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDateLocal(input: string): Date {
  const ymd = input.length >= 10 ? input.slice(0, 10) : input;
  return new Date(ymd + "T00:00:00");
}

function formatDefaultTitle(yyyymmdd: string): string {
  return parseDateLocal(yyyymmdd).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function NewJournalScreen() {
  const router = useRouter();
  const { isSetup, isUnlocked } = useJournalCrypto();

  const [title, setTitle] = useState("");
  // New entries are always TipTap JSON — there's no legacy HTML for a fresh
  // doc. The shared JournalEditor is uncontrolled after mount (it owns the
  // document); we keep the latest JSON here for the save.
  const [content, setContent] = useState<RichTextEditorContent>(EMPTY_DOC);
  const [mood, setMood] = useState<number | undefined>(undefined);
  const [moodOpen, setMoodOpen] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [date, setDate] = useState(localDateKey());

  // Locked = encryption configured but no DEK in memory. We can't encrypt a
  // new entry without the DEK, so send the writer to the list to unlock.
  const locked = isSetup && !isUnlocked;

  const effectiveTitle = title.trim() || formatDefaultTitle(date);
  const currentMood = MOOD_DEFAULT_OPTIONS.find((m) => m.value === mood);

  // Debounced autosave (PWA parity). First non-empty change POSTs; the hook
  // keeps the created id for subsequent PATCHes. No URL rewrite — we keep
  // editing in place so the 10tap editor never blurs mid-typing.
  // `journalId` (set after the first save) excludes this draft from the
  // other-words-today sum below, so autosave doesn't double-count us.
  const { scheduleSave, status, journalId } = useAutosave({});

  // Daily word target + words already written in OTHER entries today — feeds
  // the shared editor's progress strip and target-crossing celebration.
  // `wordCount` is plaintext metadata even on encrypted entries, so the raw
  // journals cache is enough (no decrypt needed).
  const lightQuery = useUserLight();
  const wordTarget = lightQuery.data?.journalTargetDailyWords ?? 0;
  const journalsQuery = useJournals();
  const todayKey = localDateKey();
  const otherWordsToday = useMemo(
    () =>
      (journalsQuery.data ?? [])
        .filter((j) => j.date.slice(0, 10) === todayKey && j.id !== journalId)
        .reduce((sum, j) => sum + (j.wordCount ?? 0), 0),
    [journalsQuery.data, todayKey, journalId],
  );

  const lastSavedRef = useRef<{
    title: string;
    content: RichTextEditorContent;
    mood: number | undefined;
    tags: string[];
    date: string;
  }>({
    title: "",
    content: EMPTY_DOC,
    mood: undefined,
    tags: [],
    date: "",
  });

  // Schedule a save when something actually changed. The empty-draft guard
  // (no title, no words, no mood, no tags) keeps backing out from creating
  // an orphan entry; the "changed since last scheduled?" check stops the
  // mount tick and picker round-trips from re-saving identical data.
  // Content/tags compare via JSON.stringify — two identical JSON docs are
  // never `===`.
  useEffect(() => {
    if (
      !title.trim() &&
      countWordsFromContent(content) === 0 &&
      mood === undefined &&
      tags.length === 0
    )
      return;
    const last = lastSavedRef.current;
    if (
      effectiveTitle === last.title &&
      JSON.stringify(content) === JSON.stringify(last.content) &&
      mood === last.mood &&
      JSON.stringify(tags) === JSON.stringify(last.tags) &&
      date === last.date
    )
      return;
    lastSavedRef.current = { title: effectiveTitle, content, mood, tags, date };
    scheduleSave({ title: effectiveTitle, content, mood, tags, date });
  }, [effectiveTitle, content, mood, tags, date, scheduleSave, title]);

  // ---- Locked: can't encrypt without the DEK — bounce to the list ----
  if (locked) {
    return (
      <YStack flex={1} bg="$background">
        <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
          <BackBar
            onBack={() => router.navigate("/journal")}
            title="New Entry"
          />
          <YStack flex={1} items="center" justify="center" gap="$3" px="$6">
            <Text fontSize="$5" fontWeight="600" color="$color">
              Journal locked
            </Text>
            <Text fontSize="$3" color="$mutedForeground" text="center">
              Unlock your journal first, then come back to write a new entry.
            </Text>
            <Button intent="primary" onPress={() => router.replace("/journal")}>
              Go to journal
            </Button>
          </YStack>
        </SafeAreaView>
      </YStack>
    );
  }

  return (
    <YStack flex={1} bg="$background">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        {/* Header: icon back (left) · centered title · Done (right). The
            title is absolutely centered so it sits at the true screen center
            regardless of the differing left/right control widths; it's
            pointer-transparent so it never intercepts a tap meant for a
            button. Done just returns to the list — autosave owns
            persistence (the save-status badge lives in the editor toolbar). */}
        <XStack
          items="center"
          justify="space-between"
          px="$2"
          py="$2"
          position="relative"
        >
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="Back to journal"
            onPress={() => router.navigate("/journal")}
          >
            <ChevronLeft size={20} />
          </IconButton>
          <Text
            position="absolute"
            l={0}
            r={0}
            text="center"
            pointerEvents="none"
            fontSize="$5"
            fontWeight="600"
            color="$color"
          >
            New Entry
          </Text>
          <Button
            intent="primary"
            size="sm"
            mr="$2"
            onPress={() => router.navigate("/journal")}
          >
            Done
          </Button>
        </XStack>

        <YStack shrink={0} px="$4" pt="$2">
          {/* Bare title — raw tamagui Input, no kit Frame chrome. Placeholder is
              the date label (the PWA uses the date as the default title). */}
          <BareInput
            value={title}
            onChangeText={setTitle}
            placeholder={formatDefaultTitle(date)}
            width="100%"
            mb="$3"
            px={0}
            bg="transparent"
            borderWidth={0}
            outlineWidth={0}
            fontSize={24}
            fontWeight="700"
            color="$color"
            placeholderTextColor="$mutedForeground"
            focusStyle={{ borderWidth: 0, outlineWidth: 0 }}
            focusVisibleStyle={{ outlineWidth: 0 }}
          />

          {/* Metadata chips — date · mood · tags. All `size="sm"` so the row
              reads as one consistent set of chips.

              onTouchStart dismisses the EDITOR's keyboard the moment the user
              touches any chip. The editor is a 10tap WEBVIEW — RN's
              `Keyboard.dismiss()` (what the kit Select/QDP call) can't close a
              webview keyboard, so the date sheet would open with the keyboard
              still up. `KeyboardController.dismiss()` resigns the native first
              responder (incl. the webview), and as a bonus it frees focus so
              the inline Tag field can take the keyboard when it expands. */}
          <XStack
            mb="$4"
            flexWrap="wrap"
            items="center"
            gap="$2"
            onTouchStart={() => {
              void KeyboardController.dismiss();
            }}
          >
            <QuickDatePicker
              size="sm"
              value={parseDateLocal(date)}
              onChange={(d) => {
                if (d) setDate(localDateKey(d));
              }}
              clearable={false}
            />

            {/* Mood — a small chip that opens a bottom Sheet with the kit
                MoodPicker. The MoodPicker's bubbles are a fixed 48px; in a
                cramped popover they overflowed, so we give them a full-width
                sheet (consistent with the date picker's sheet on native). */}
            <Button
              intent="outline"
              size="sm"
              rounded={9999}
              gap="$1.5"
              onPress={() => setMoodOpen(true)}
              icon={
                currentMood ? (
                  <Text fontSize="$3">{currentMood.emoji}</Text>
                ) : (
                  <SmilePlus size={14} color="$mutedForeground" />
                )
              }
            >
              <Text fontSize="$2" color="$mutedForeground">
                {currentMood?.label ?? "Mood"}
              </Text>
            </Button>

            {/* Tags — kit TagInput inline (chips + a "+ Tag" pill). */}
            <TagInput value={tags} onChange={setTags} inline addLabel="Tag" />
          </XStack>
        </YStack>

        {/* Editor fills the rest. Same shared view the PWA renders; it owns the
            kit RichTextEditor (10tap), word count, and target-crossing. The
            web-only progress bar / celebration / dead-zone handler are omitted
            (those render-props are optional). */}
        <View flex={1}>
          <JournalEditor
            initialContent={content}
            onChange={setContent}
            placeholder="What's on your mind?"
            autoFocus
            saveStatus={status}
            target={wordTarget}
            otherWordsToday={otherWordsToday}
            renderProgress={(state) => <JournalTargetProgress {...state} />}
            renderCelebration={(trigger) => (
              <JournalTargetCelebration trigger={trigger} />
            )}
          />
        </View>
      </SafeAreaView>

      {/* Mood picker — bottom sheet so the kit MoodPicker's fixed-48px bubbles
          get a full-width row to sit in (a popover cramped them). Content-hug
          via fit; closes on pick or overlay tap. */}
      <Sheet
        modal
        open={moodOpen}
        onOpenChange={setMoodOpen}
        dismissOnSnapToBottom
        snapPointsMode="fit"
      >
        <Sheet.Overlay />
        {/* pt 0 — the kit grabber is the frame's first child with its own
            spacing; top padding would sink it (FormSheet convention). */}
        <Sheet.Frame pt={0} pb="$6" px="$4" gap="$3">
          <Text fontSize="$5" fontWeight="600" color="$color">
            How are you feeling?
          </Text>
          <XStack justify="center" py="$2">
            {/* Bridge number|undefined ↔ the kit's number|null at the edge.
                clearable so tapping the active mood again removes it. */}
            <MoodPicker
              value={mood ?? null}
              showLabels
              clearable
              onChange={(v) => {
                setMood(v ?? undefined);
                setMoodOpen(false);
              }}
            />
          </XStack>
        </Sheet.Frame>
      </Sheet>
    </YStack>
  );
}

/* ------------------------------- Back bar ---------------------------------- */

function BackBar({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <XStack items="center" px="$2" py="$2" position="relative">
      <IconButton
        variant="ghost"
        size="sm"
        aria-label="Back to journal"
        onPress={onBack}
      >
        <ChevronLeft size={20} />
      </IconButton>
      <Text
        position="absolute"
        l={0}
        r={0}
        text="center"
        pointerEvents="none"
        fontSize="$5"
        fontWeight="600"
        color="$color"
      >
        {title}
      </Text>
    </XStack>
  );
}
