import { useState, useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { parseDateLocal } from "@/lib/date";
import { ArrowLeft, Trash2, X } from "lucide-react";
import { JournalEditor } from "@/components/journal/journal-editor";
import { TagInput } from "@/components/journal/tag-input";
import {
  AlertDialog,
  Button,
  IconButton,
  Input,
  Popover,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import { useJournal, useDeleteJournal } from "@/lib/api/journals";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { useAutosave } from "@/lib/hooks/use-autosave";
import { toast } from "sonner";
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
  const isDesktop = useMediaQuery("(min-width: 768px)");

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
        toast.success("Journal entry deleted");
        navigate({ to: "/journal" });
      },
      onError: () => {
        toast.error("Failed to delete journal entry");
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
      <YStack shrink={0} px="$4" pt="$4" overflow="hidden">
        {!isDesktop && (
          <View mb="$5">
            <XStack
              tag="button"
              items="center"
              gap="$1"
              fontSize="$3"
              color="$mutedForeground"
              hoverStyle={{ color: "$color" }}
              onPress={() => navigate({ to: "/journal" })}
            >
              <ArrowLeft size={16} />
              Back
            </XStack>
          </View>
        )}

        {/* Title + delete */}
        <XStack mb="$3" items="center" gap="$2">
          {/* `paddingHorizontal={0}` strips the kit Input's internal
              horizontal inset that survives `unstyled`. Keeps the title
              text aligned with the pills row below. */}
          <Input
            value={title}
            onChangeText={setTitle}
            placeholder="Untitled"
            unstyled
            flex={1}
            minW={0}
            paddingHorizontal={0}
            bg="transparent"
            fontSize={24}
            fontWeight="700"
            color="$color"
            placeholderTextColor="$mutedForeground"
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

        {/* Metadata pills row */}
        <XStack mb="$4" flexWrap="wrap" items="center" gap="$2">
          {/* Date pill (read-only for existing entries) */}
          <XStack
            items="center"
            gap="$1"
            fontSize="$1"
            color="$mutedForeground"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="21" y1="10" y2="10" />
            </svg>
            {dateLabel}
          </XStack>

          {/* Mood pill */}
          <Popover placement="bottom-start">
            <Popover.Trigger asChild>
              <XStack
                tag="button"
                items="center"
                gap="$1"
                fontSize="$1"
                color="$mutedForeground"
                transition="quick"
                hoverStyle={{ color: "$color" }}
              >
                {currentMood ? (
                  <XStack items="center" gap="$1">
                    <Text fontSize="$3">{currentMood.emoji}</Text>
                    {currentMood.label}
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
                    <Text fontSize="$1">{"\u{1F642}"}</Text>
                    Mood
                  </XStack>
                )}
              </XStack>
            </Popover.Trigger>
            <Popover.Content width="auto" p="$1">
              <XStack items="center" gap="$1">
                {moods.map((m) => (
                  <XStack
                    key={m.value}
                    tag="button"
                    items="center"
                    justify="center"
                    height={36}
                    width={36}
                    rounded="$lg"
                    fontSize="$6"
                    transition="quick"
                    bg={mood === m.value ? "$accent" : undefined}
                    hoverStyle={{ bg: "$accent" }}
                    title={m.label}
                    onPress={() =>
                      setMood(mood === m.value ? undefined : m.value)
                    }
                  >
                    {m.emoji}
                  </XStack>
                ))}
              </XStack>
            </Popover.Content>
          </Popover>

          {/* Tag pills */}
          {tags.map((tag) => (
            <XStack
              key={tag}
              items="center"
              gap="$1"
              rounded={9999}
              bg="$accent"
              px="$2"
              py="$0.5"
              fontSize="$1"
              color="$accentForeground"
            >
              {tag}
              <View
                tag="button"
                color="$mutedForeground"
                hoverStyle={{ color: "$color" }}
                onPress={() => setTags(tags.filter((t) => t !== tag))}
              >
                <X size={12} />
              </View>
            </XStack>
          ))}

          {/* Add tag pill */}
          <TagInput tags={tags} onChange={setTags} inline />
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

      <AlertDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        disableRemoveScroll
      >
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
    </YStack>
  );
}
