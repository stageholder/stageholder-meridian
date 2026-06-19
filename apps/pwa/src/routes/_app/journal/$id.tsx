import { useState, useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { parseDateLocal } from "@/lib/date";
import { ArrowLeft, CalendarDays, Trash2 } from "lucide-react";
import { JournalEditor } from "@/components/journal/journal-editor";
import {
  AlertDialog,
  Button,
  Hide,
  IconButton,
  MoodPicker,
  Popover,
  TagInput,
  Text,
  useToast,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
// The title uses a raw tamagui Input (see below) — bare, no kit Frame chrome.
import { Input as BareInput } from "tamagui";
import { BLOCK_GUTTER } from "@repo/features/journal";
import { useJournal, useDeleteJournal } from "@/lib/api/journals";
import { useAutosave } from "@/lib/hooks/use-autosave";
import type { JournalContent } from "@repo/core/types";

export const Route = createFileRoute("/_app/journal/$id")({
  component: JournalEntryPage,
});

const moods = [
  { value: 1, label: "Terrible", emoji: "\u{1F622}" },
  { value: 2, label: "Bad", emoji: "\u{1F641}" },
  { value: 3, label: "Okay", emoji: "\u{1F610}" },
  { value: 4, label: "Good", emoji: "\u{1F642}" },
  { value: 5, label: "Great", emoji: "\u{1F604}" },
];

function JournalEntryPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: journal, isLoading } = useJournal(id);
  const deleteJournal = useDeleteJournal();
  const toast = useToast();

  const [title, setTitle] = useState("");
  // Dual-format content during Phase 2: legacy entries arrive as HTML
  // strings, new entries as TipTap JSON objects. JournalEditor accepts
  // both on input and always emits JSON, so by the time autosave fires
  // we're writing JSON regardless of the source format.
  const [content, setContent] = useState<JournalContent>("");
  const [mood, setMood] = useState<number | undefined>(undefined);
  const [tags, setTags] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);
  const lastSavedRef = useRef<{
    title: string;
    content: JournalContent;
    mood: number | undefined;
    tags: string[];
  }>({
    title: "",
    content: "",
    mood: undefined,
    tags: [] as string[],
  });
  const journalDateRef = useRef("");

  const { scheduleSave, status } = useAutosave({ journalId: id });

  const currentMood = moods.find((m) => m.value === mood);

  // Initialize form state from fetched journal (once)
  useEffect(() => {
    if (journal && !initialized) {
      setTitle(journal.title);
      setContent(journal.content);
      setMood(journal.mood);
      setTags(Array.isArray(journal.tags) ? journal.tags : []);
      lastSavedRef.current = {
        title: journal.title,
        content: journal.content,
        mood: journal.mood,
        tags: Array.isArray(journal.tags) ? journal.tags : [],
      };
      journalDateRef.current = journal.date;
      setInitialized(true);
    }
  }, [journal, initialized]);

  // Autosave when user changes something — compare against last saved,
  // not fetched journal. Content comparison uses JSON.stringify to handle
  // both string (legacy HTML) and object (TipTap JSON) shapes uniformly.
  useEffect(() => {
    if (!initialized) return;
    const last = lastSavedRef.current;
    if (
      title === last.title &&
      JSON.stringify(content) === JSON.stringify(last.content) &&
      mood === last.mood &&
      JSON.stringify(tags) === JSON.stringify(last.tags)
    )
      return;
    const saveData = {
      title: title.trim() || last.title,
      content,
      mood,
      tags,
      date: journalDateRef.current,
    };
    lastSavedRef.current = { title: saveData.title, content, mood, tags };
    scheduleSave(saveData);
  }, [initialized, title, content, mood, tags, scheduleSave]);

  const [deleteOpen, setDeleteOpen] = useState(false);

  function confirmDelete() {
    deleteJournal.mutate(id, {
      onSuccess: () => {
        toast.show({ title: "Journal entry deleted", intent: "success" });
        navigate({ to: "/journal" });
      },
      onError: () => {
        toast.show({
          title: "Failed to delete journal entry",
          intent: "danger",
        });
      },
    });
    setDeleteOpen(false);
  }

  if (isLoading) {
    return (
      <Text p="$4" fontSize="$3" color="$mutedForeground">
        Loading...
      </Text>
    );
  }

  if (!journal) {
    return (
      <YStack py="$8" items="center">
        <Text fontSize="$3" color="$mutedForeground">
          Journal entry not found.
        </Text>
      </YStack>
    );
  }

  const dateLabel = format(parseDateLocal(journal.date), "MMM d, yyyy");

  return (
    // 3-pane layout (app sidebar + journal list + editor) means the
    // editor *pane* fills the available column — no artificial max-width.
    // Single-pane-editor patterns (centered max-w-720) don't fit here;
    // they'd create "column-in-a-column" with awkward right-side empty
    // space. Reference: Bear, Notion's page editor, Day One — all fill
    // the editor pane in their multi-pane layouts.
    //
    // Padding is via Tamagui spacing tokens ($6 ≈ 24px horizontal,
    // breathing room on both sides).
    <YStack flex={1} height="100%" overflow="hidden">
      {/* No horizontal padding on the header: the only horizontal inset is the
          block gutter (BLOCK_GUTTER), applied directly to the title / pills so
          they line up with the gutter-indented body text. */}
      <YStack shrink={0} pt="$4" overflow="hidden">
        <Hide above="md">
          <View mb="$3" pl={BLOCK_GUTTER}>
            {/* `self="flex-start"` stops the ghost button from stretching
                full-width (which centered its label — the "strange" look);
                `ml="$-2"` nudges the icon back so the "←" lines up with the
                gutter-indented title's left edge below it. */}
            <Button
              intent="ghost"
              size="sm"
              self="flex-start"
              ml="$-2"
              icon={<ArrowLeft size={16} />}
              onPress={() => navigate({ to: "/journal" })}
            >
              Back
            </Button>
          </View>
        </Hide>

        {/* Title + delete. `pl`/`pr={BLOCK_GUTTER}` inset the row by the block
            gutter on both sides so the title lines up with the body text and the
            delete button sits at the content's right edge (not the screen edge). */}
        <XStack
          mb="$3"
          pl={BLOCK_GUTTER}
          pr={BLOCK_GUTTER}
          items="center"
          gap="$2"
        >
          {/* Bare title — a raw tamagui Input, not the kit Input: the kit
              wraps its field in a bordered Frame whose focus ring (the boxed
              outline) can't be reached from call-site props. `px={0}` keeps
              the text aligned with the pills row below; border + outline are
              zeroed so focusing shows just the caret, no box. */}
          <BareInput
            value={title}
            onChangeText={setTitle}
            placeholder="Untitled"
            flex={1}
            minW={0}
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
          <IconButton
            variant="ghost"
            size="sm"
            intent="danger"
            onPress={() => setDeleteOpen(true)}
            aria-label="Delete entry"
            title="Delete entry"
          >
            <Trash2 size={16} />
          </IconButton>
        </XStack>

        {/* Metadata pills row — indented by the block gutter to align with the
            title above and the body text below. */}
        <XStack
          mb="$4"
          pl={BLOCK_GUTTER}
          flexWrap="wrap"
          items="center"
          gap="$2"
        >
          {/* Date pill (read-only for existing entries) */}
          <XStack items="center" gap="$1">
            <Text color="$mutedForeground" lineHeight={0}>
              <CalendarDays size={12} />
            </Text>
            <Text fontSize="$1" color="$mutedForeground">
              {dateLabel}
            </Text>
          </XStack>

          {/* Mood pill */}
          <Popover placement="bottom-start">
            <Popover.Trigger asChild>
              <Button intent="ghost" size="sm" gap="$1">
                <Text fontSize="$3">
                  {currentMood ? currentMood.emoji : "\u{1F642}"}
                </Text>
                <Text fontSize="$1" color="$mutedForeground">
                  {currentMood ? currentMood.label : "Mood"}
                </Text>
              </Button>
            </Popover.Trigger>
            <Popover.Content width="auto" p="$2">
              <MoodPicker
                value={mood ?? null}
                onChange={(v) => setMood(v ?? undefined)}
                options={moods}
                clearable
              />
            </Popover.Content>
          </Popover>

          {/* Tags — kit TagInput inline mode renders the chips + a "+ Tag" pill */}
          <TagInput value={tags} onChange={setTags} inline />
        </XStack>
      </YStack>

      {initialized && (
        <JournalEditor
          content={content}
          onChange={setContent}
          date={journal.date}
          excludeJournalId={id}
          saveStatus={status}
        />
      )}

      {/* Conditionally mounted so CLOSING UNMOUNTS the dialog (overlay removed
          instantly). The kit's exit-presence (<Animate presence> →
          onExitComplete) doesn't fire under this app's runtime-CSS setup
          (Tailwind coexistence forces disableExtraction, so the CSS driver's
          exit transitionend never lands) — closing via state alone left the
          scrim stuck. A full unmount, which the delete-mutation path already
          triggers, clears it reliably. */}
      {deleteOpen && (
        <AlertDialog open onOpenChange={setDeleteOpen} disableRemoveScroll>
          <AlertDialog.Portal>
            <AlertDialog.Overlay />
            <AlertDialog.Content>
              <AlertDialog.Title>Delete this entry?</AlertDialog.Title>
              <AlertDialog.Description>
                This journal entry will be permanently removed. This cannot be
                undone.
              </AlertDialog.Description>
              <XStack gap="$2" justify="flex-end" mt="$4">
                <AlertDialog.Cancel asChild>
                  <Button intent="outline">Cancel</Button>
                </AlertDialog.Cancel>
                <AlertDialog.Action asChild>
                  <Button intent="destructive" onPress={confirmDelete}>
                    Delete
                  </Button>
                </AlertDialog.Action>
              </XStack>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        </AlertDialog>
      )}
    </YStack>
  );
}
