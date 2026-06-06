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
// Why an explicit SAVE (not the PWA's autosave): the PWA's use-autosave carries
// web-specific TanStack-Router remount workarounds and can create an entry on
// the first keystroke. On mobile a single Save on done is clearer and never
// leaves an orphan empty entry. One create call, then back to the list.
//
// Encryption: the create mutation encrypts inline when a DEK is present. If
// encryption is SET UP but LOCKED (no DEK in memory), we can't encrypt — bounce
// the writer to the journal list, which owns the unlock flow.

import {
  Button,
  MoodPicker,
  MOOD_DEFAULT_OPTIONS,
  Popover,
  QuickDatePicker,
  Spinner,
  TagInput,
  Text,
  View,
  XStack,
  YStack,
  useToast,
} from "@stageholder/ui";
import { JournalEditor } from "@repo/features/journal";
import type { JournalContent } from "@repo/core/types";
import { countWordsFromContent } from "@repo/core/utils/text";
import { ChevronLeft } from "@tamagui/lucide-icons-2";
// Bare tamagui Input for the title — no kit Frame chrome, matching the PWA's
// bare title field (kit Input wraps a bordered Frame whose focus ring can't be
// zeroed from call-site props).
import { Input as BareInput } from "tamagui";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { useCreateJournal } from "@/lib/api";
import { useJournalCrypto } from "@/lib/journal-crypto";

/** Empty TipTap doc — the editor seeds from this for a fresh entry. */
const EMPTY_DOC: JournalContent = {
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
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const createJournal = useCreateJournal();
  const { isSetup, isUnlocked } = useJournalCrypto();

  const [title, setTitle] = useState("");
  // New entries are always TipTap JSON — there's no legacy HTML for a fresh
  // doc. The shared JournalEditor is uncontrolled after mount (it owns the
  // document); we keep the latest JSON here for the save.
  const [content, setContent] = useState<JournalContent>(EMPTY_DOC);
  const [mood, setMood] = useState<number | undefined>(undefined);
  const [tags, setTags] = useState<string[]>([]);
  const [date, setDate] = useState(localDateKey());

  // Locked = encryption configured but no DEK in memory. We can't encrypt a
  // new entry without the DEK, so send the writer to the list to unlock.
  const locked = isSetup && !isUnlocked;

  const effectiveTitle = title.trim() || formatDefaultTitle(date);
  const currentMood = MOOD_DEFAULT_OPTIONS.find((m) => m.value === mood);
  // Save needs at least some text (matches the PWA, which won't autosave an
  // empty doc). Title alone isn't enough — an entry is its content.
  const hasContent = countWordsFromContent(content) > 0;

  function handleSave() {
    if (!hasContent || createJournal.isPending) return;
    createJournal.mutate(
      {
        title: effectiveTitle,
        content,
        mood,
        tags,
        date,
      },
      {
        onSuccess: () => {
          toast.show({ title: "Entry saved", intent: "success" });
          router.back();
        },
        onError: () => {
          toast.show({ title: "Failed to save entry", intent: "danger" });
        },
      },
    );
  }

  // ---- Locked: can't encrypt without the DEK — bounce to the list ----
  if (locked) {
    return (
      <YStack flex={1} bg="$background">
        <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
          <BackBar onBack={() => router.back()} />
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
        {/* Header: back + Save. Save is disabled until there's text and while
            the create mutation is in flight (spinner replaces the label). */}
        <XStack items="center" justify="space-between" px="$2" py="$2">
          <Button
            intent="ghost"
            size="sm"
            icon={<ChevronLeft size={18} />}
            onPress={() => router.back()}
          >
            Journal
          </Button>
          <Button
            intent="primary"
            size="sm"
            mr="$2"
            disabled={!hasContent || createJournal.isPending}
            onPress={handleSave}
          >
            {createJournal.isPending ? <Spinner size="small" /> : "Save"}
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

          {/* Metadata pills — date, mood, tags (mirrors the PWA's row). */}
          <XStack mb="$4" flexWrap="wrap" items="center" gap="$2">
            <QuickDatePicker
              value={parseDateLocal(date)}
              onChange={(d) => {
                if (d) setDate(localDateKey(d));
              }}
              clearable={false}
            />

            {/* Mood — kit MoodPicker in an anchored Popover. (This screen is a
                full-screen route, NOT a bottom Sheet, so a Popover renders
                correctly above it — the sheet-behind-popover gotcha that drove
                the habit form's EmojiPickerSheet doesn't apply here.) */}
            <Popover placement="bottom-start">
              <Popover.Trigger asChild>
                <Button intent="ghost" size="sm" gap="$1">
                  {currentMood ? (
                    <XStack items="center" gap="$1">
                      <Text fontSize="$3">{currentMood.emoji}</Text>
                      {currentMood.label ? (
                        <Text fontSize="$1" color="$mutedForeground">
                          {currentMood.label}
                        </Text>
                      ) : null}
                    </XStack>
                  ) : (
                    <XStack
                      items="center"
                      gap="$1"
                      rounded={9999}
                      borderWidth={1}
                      borderStyle="dashed"
                      borderColor="$borderColor"
                      px="$2"
                      py="$0.5"
                    >
                      <Text fontSize="$1">🙂</Text>
                      <Text fontSize="$1" color="$mutedForeground">
                        Mood
                      </Text>
                    </XStack>
                  )}
                </Button>
              </Popover.Trigger>
              <Popover.Content width="auto" p="$2">
                {/* Bridge number|undefined ↔ the kit's number|null at the edge. */}
                <MoodPicker
                  value={mood ?? null}
                  onChange={(v) => setMood(v ?? undefined)}
                />
              </Popover.Content>
            </Popover>

            {/* Tags — kit TagInput inline mode (chips + a "+ Tag" pill). */}
            <TagInput value={tags} onChange={setTags} inline />
          </XStack>
        </YStack>

        {/* Editor fills the rest. Same shared view the PWA renders; it owns the
            kit RichTextEditor (10tap), word count, and target-crossing. The
            web-only progress bar / celebration / dead-zone handler are omitted
            (those render-props are optional). */}
        <View flex={1} pb={insets.bottom}>
          <JournalEditor
            initialContent={content}
            onChange={setContent}
            placeholder="What's on your mind?"
            autoFocus
            target={0}
            otherWordsToday={0}
          />
        </View>
      </SafeAreaView>
    </YStack>
  );
}

/* ------------------------------- Back bar ---------------------------------- */

function BackBar({ onBack }: { onBack: () => void }) {
  return (
    <XStack px="$2" py="$2">
      <Button
        intent="ghost"
        size="sm"
        icon={<ChevronLeft size={18} />}
        onPress={onBack}
      >
        Journal
      </Button>
    </XStack>
  );
}
