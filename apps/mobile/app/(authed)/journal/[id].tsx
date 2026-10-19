// apps/mobile/app/(authed)/journal/[id].tsx
//
// Journal entry detail — a FULL EDITOR (parity with the PWA's $id route).
// Fetches the entry via `useJournal(id)`, which now decrypts it with the
// in-memory DEK INSIDE its queryFn (Phase 4d, PWA parity — off the render
// path), then seeds the shared rich-text JournalEditor (10tap on native) so
// the entry can be re-read AND edited. Save encrypts title/content/tags
// before the PATCH (see useUpdateJournal) — the same end-to-end boundary as
// creation.
//
// Editing mirrors journal/new.tsx: debounced AUTOSAVE (PWA parity) — every
// settled change PATCHes via use-autosave; the header's Done just returns to
// the list. The editor body is split into its own <EntryEditor> that mounts
// ONLY once the decrypted entry is ready, so its initial state (and the
// autosave's last-saved baseline) seeds cleanly from the entry.
//
// Hidden from the tab bar via `href: null` in (authed)/_layout.tsx. If the
// journal is locked (no DEK) we bounce the reader to the list to unlock.

import { useStagedMount } from "@/lib/hooks/use-staged-mount";
import {
  Banner,
  Button,
  Sheet,
  Spinner,
  TagInput,
  Text,
  View,
  XStack,
  YStack,
  toast,
} from "@stageholder/ui";
import {
  MoodPicker,
  MOOD_DEFAULT_OPTIONS,
  QuickDatePicker,
} from "@stageholder/ui/pickers";
import type { RichTextEditorContent } from "@stageholder/ui/editor";
import { JournalEditor } from "@repo/features/journal";
import type { Journal, JournalContent } from "@repo/core/types";
import { SmilePlus } from "@tamagui/lucide-icons-2/icons/SmilePlus";
import { Input as BareInput } from "tamagui";
import { Alert } from "react-native";
import { KeyboardController } from "react-native-keyboard-controller";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  JournalTargetCelebration,
  JournalTargetProgress,
} from "@/components/journal-progress";
import {
  useDeleteJournal,
  useJournal,
  useJournals,
  useUserLight,
} from "@/lib/api";
import { JournalEditorHeader } from "@/components/journal-editor-header";
import { useAutosave } from "@/lib/use-autosave";
import { useJournalCrypto } from "@/lib/journal-crypto";

function parseDateLocal(input: string): Date {
  const ymd = input.length >= 10 ? input.slice(0, 10) : input;
  return new Date(ymd + "T00:00:00");
}

function localDateKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDefaultTitle(yyyymmdd: string): string {
  return parseDateLocal(yyyymmdd).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function JournalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const journalQuery = useJournal(id);
  const { isUnlocked } = useJournalCrypto();

  // `raw` is ALREADY DECRYPTED by the time it reaches this screen — useJournal
  // decrypts inside its queryFn (Phase 4d, PWA parity — off the render path).
  // A decrypt failure now throws INSIDE the queryFn, so it surfaces as
  // `journalQuery.error` below instead of a separate decrypt-error state.
  const raw = journalQuery.data;

  // ---- Loading ----
  if (journalQuery.isLoading) {
    return (
      <Scaffold>
        <Centered>
          <Spinner size="large" />
        </Centered>
      </Scaffold>
    );
  }

  // ---- Error (fetch or decrypt — decrypt failures throw inside the hook's
  // queryFn now, so both land here as journalQuery.error). ----
  if (journalQuery.error) {
    return (
      <Scaffold>
        <YStack px="$4" pt="$2">
          <Banner intent="danger">
            <Banner.Body>
              <Banner.Title>Couldn&apos;t open this entry</Banner.Title>
              <Banner.Description>
                {(journalQuery.error as Error)?.message ?? "Network error."}
              </Banner.Description>
              <Banner.Action self="flex-end" mt="$2">
                <Button
                  intent="secondary"
                  size="sm"
                  onPress={() => void journalQuery.refetch()}
                >
                  Try again
                </Button>
              </Banner.Action>
            </Banner.Body>
          </Banner>
        </YStack>
      </Scaffold>
    );
  }

  // ---- Locked: entry is encrypted-at-rest and the DEK isn't in memory ----
  // `raw.encrypted` stays `true` even on a successfully decrypted entry (the
  // decrypt helper doesn't flip the flag), so "still locked" can't be read off
  // the entry itself anymore — gate on the crypto store's `isUnlocked`
  // instead. While locked, `raw` (if present from a placeholder/list seed) is
  // still ciphertext, so it's never handed to the editor below.
  const locked = !!raw?.encrypted && !isUnlocked;
  if (locked) {
    return (
      <Scaffold>
        <YStack px="$4" pt="$2" gap="$3">
          <Banner intent="neutral">
            <Banner.Body>
              <Banner.Title>Journal locked</Banner.Title>
              <Banner.Description>
                Unlock your journal from the list to read or edit this entry.
              </Banner.Description>
              <Banner.Action self="flex-end" mt="$2">
                <Button
                  intent="secondary"
                  size="sm"
                  onPress={() =>
                    router.canGoBack()
                      ? router.back()
                      : router.replace("/journal")
                  }
                >
                  Go to journal
                </Button>
              </Banner.Action>
            </Banner.Body>
          </Banner>
        </YStack>
      </Scaffold>
    );
  }

  if (!raw) {
    return (
      <Scaffold>
        <Centered>
          <Spinner size="large" />
        </Centered>
      </Scaffold>
    );
  }

  // Decrypted (or plaintext-account) + ready → the editor mounts seeded from
  // this entry.
  //
  // KEYED ON PROVISIONAL-vs-AUTHORITATIVE. `useJournal` seeds `placeholderData`
  // from the list caches so the entry opens instantly — but a list row can be
  // STALE (notably the paginated InfiniteData cache). EntryEditor seeds every
  // field through `useState` initializers, which never re-run, so without a key
  // the editor would hold the stale body and the next keystroke would autosave
  // it back over the newer server copy — silent data loss.
  //
  // The key must NOT include `updatedAt`: autosave writes the server entry into
  // the detail cache, so an `updatedAt` key would remount the editor on every
  // save and drop the user's buffer. `isPlaceholderData` flips exactly once
  // (provisional → authoritative) and then stays false for the life of the
  // screen, so the editor re-seeds when the real entry lands and never again.
  const seedKey = journalQuery.isPlaceholderData
    ? `provisional-${raw.updatedAt}`
    : `entry-${raw.id}`;
  return <EntryEditor key={seedKey} entry={raw} />;
}

/* ------------------------------- Editor ------------------------------------ */

function EntryEditor({ entry }: { entry: Journal }) {
  const router = useRouter();
  const deleteJournal = useDeleteJournal();
  // Defer the heavy 10tap WebView editor one beat so opening an entry paints the
  // header/title/chips + a body skeleton on the tap frame instead of blocking on
  // the WebView boot (the "wait long until the detail shows up"). The editor
  // mounts ~60ms later — see use-staged-mount.
  const editorReady = useStagedMount();

  // Platform-native destructive confirm (PWA parity: its $id page deletes
  // behind a web AlertDialog). Navigates straight back on success — there's
  // nothing left to edit.
  function confirmDelete() {
    Alert.alert("Delete this entry?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          // Stop autosave first so the unmount flush can't PATCH the entry
          // we're deleting.
          void discard().then(() =>
            deleteJournal.mutate(entry.id, {
              onSuccess: () => {
                toast.success("Entry deleted");
                if (router.canGoBack()) router.back();
                else router.replace("/journal");
              },
              onError: () => toast.error("Couldn't delete entry"),
            }),
          ),
      },
    ]);
  }

  // Seed from the (already-decrypted) entry — this component only mounts once
  // the entry is ready, so a plain useState initializer is correct.
  const [title, setTitle] = useState(entry.title ?? "");
  const [content, setContent] = useState<JournalContent>(entry.content);
  const [mood, setMood] = useState<number | undefined>(entry.mood ?? undefined);
  const [moodOpen, setMoodOpen] = useState(false);
  // Decrypted tags are string[]; the encrypted-at-rest form is a string. This
  // editor only mounts post-decrypt, so it's an array — guard anyway.
  const [tags, setTags] = useState<string[]>(
    Array.isArray(entry.tags) ? entry.tags : [],
  );
  const [date, setDate] = useState(localDateKey(parseDateLocal(entry.date)));

  const effectiveTitle = title.trim() || formatDefaultTitle(date);
  const currentMood = MOOD_DEFAULT_OPTIONS.find((m) => m.value === mood);

  // Debounced autosave (PWA parity) — always PATCHes this entry's id. The
  // baseline seeds from the entry so the mount tick never fires a no-op save.
  const { scheduleSave, flush, discard, status } = useAutosave({
    journalId: entry.id,
  });

  // Daily word target + words in OTHER entries today (this entry excluded —
  // its live count comes from the editor). `wordCount` stays plaintext on
  // encrypted entries, so the raw cache suffices.
  const lightQuery = useUserLight();
  const wordTarget = lightQuery.data?.journalTargetDailyWords ?? 0;
  const journalsQuery = useJournals();
  const todayKey = localDateKey();
  const otherWordsToday = useMemo(
    () =>
      (journalsQuery.data ?? [])
        .filter((j) => j.date.slice(0, 10) === todayKey && j.id !== entry.id)
        .reduce((sum, j) => sum + (j.wordCount ?? 0), 0),
    [journalsQuery.data, todayKey, entry.id],
  );

  const lastSavedRef = useRef<{
    title: string;
    content: JournalContent;
    mood: number | undefined;
    tags: string[];
    date: string;
  }>({
    title: entry.title ?? "",
    content: entry.content,
    mood: entry.mood ?? undefined,
    tags: Array.isArray(entry.tags) ? entry.tags : [],
    date: localDateKey(parseDateLocal(entry.date)),
  });

  // Schedule a save when something actually changed since the last scheduled
  // save. Content/tags compare via JSON.stringify (two identical JSON docs
  // are never `===`); the title falls back to the date label like creation.
  useEffect(() => {
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
  }, [effectiveTitle, content, mood, tags, date, scheduleSave]);

  return (
    <YStack flex={1} bg="$background">
      <JournalEditorHeader
        title="Entry"
        status={status}
        flush={flush}
        menu={[
          {
            label: "Delete entry",
            destructive: true,
            onPress: confirmDelete,
          },
        ]}
      />
      <YStack shrink={0} px="$4" pt="$2">
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

        {/* Metadata chips — date · mood · tags. onTouchStart dismisses the
              editor's (webview) keyboard so the pickers open clean — see
              new.tsx for the full rationale. */}
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

          <TagInput value={tags} onChange={setTags} inline addLabel="Tag" />
        </XStack>
      </YStack>

      {/* Editor — seeded with the entry's content. 10tap accepts both TipTap
            JSON (new entries) and an HTML string (legacy) at runtime; the type
            is JSON-only, hence the cast. onChange always emits JSON. */}
      <View flex={1}>
        {editorReady ? (
          <JournalEditor
            initialContent={content as RichTextEditorContent}
            onChange={setContent}
            placeholder="What's on your mind?"
            autoFocus={false}
            saveStatus={status}
            target={wordTarget}
            otherWordsToday={otherWordsToday}
            renderProgress={(state) => <JournalTargetProgress {...state} />}
            renderCelebration={(trigger) => (
              <JournalTargetCelebration trigger={trigger} />
            )}
          />
        ) : (
          // Instant chrome: the header/title/chips above already painted; a
          // few text-line skeletons stand in while the WebView editor boots.
          <YStack px="$4" pt="$2" gap="$3">
            <View
              height={14}
              width="88%"
              rounded="$2"
              bg="$muted"
              opacity={0.5}
            />
            <View
              height={14}
              width="72%"
              rounded="$2"
              bg="$muted"
              opacity={0.5}
            />
            <View
              height={14}
              width="93%"
              rounded="$2"
              bg="$muted"
              opacity={0.5}
            />
            <View
              height={14}
              width="60%"
              rounded="$2"
              bg="$muted"
              opacity={0.5}
            />
          </YStack>
        )}
      </View>

      {/* Mood picker — full-width bottom sheet (the kit MoodPicker's 48px
          bubbles overflow a popover). */}
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

/* ------------------------------- Chrome ------------------------------------ */

function Scaffold({ children }: { children: React.ReactNode }) {
  return (
    <YStack flex={1} bg="$background">
      {children}
    </YStack>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <View flex={1} items="center" justify="center">
      {children}
    </View>
  );
}
