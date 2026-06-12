import { useEffect, useState } from "react";
import {
  Button,
  Label,
  NumberInput,
  Select,
  Text,
  useToast,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
// Form isn't re-exported by the kit yet; pull it from the shared tamagui dep.
import { Form } from "tamagui";

export interface TargetsSettingsProps {
  /** Initial daily todo target (defaults to 3 if not provided). */
  initialTodoTarget?: number;
  /** Initial daily journal word target (defaults to 75 if not provided). */
  initialJournalTarget?: number;
  /** True while the host's initial userLight fetch is in flight. */
  isLoading?: boolean;
  /**
   * Persist the updated targets via the host's mutation. Resolves on
   * success; throws on failure. The view surfaces both outcomes through
   * kit `useToast` — the host doesn't need to wire success/error toasts.
   */
  onSubmit: (data: {
    todoTargetDaily: number;
    journalTargetDailyWords: number;
  }) => Promise<void>;
}

const JOURNAL_PRESETS = [
  { label: "Quick", value: 50 },
  { label: "Standard", value: 75 },
  { label: "Moderate", value: 150 },
  { label: "Deep", value: 250 },
  { label: "Extensive", value: 500 },
] as const;

const DEFAULT_TODO_TARGET = 3;
const DEFAULT_JOURNAL_TARGET = 75;

/**
 * Daily-targets form for the settings page (todo completion + journal
 * word count). Pure presentational — the host fetches the current
 * targets via its `useUserLight`-equivalent and supplies a single
 * `onSubmit` callback wired to the corresponding update mutation.
 *
 * Uses Tamagui `Form` for cross-platform Enter-to-submit. Feedback is
 * via kit `useToast` (cross-platform) — the host must mount a
 * `ToastProvider` ancestor, which the PWA + future mobile both do at
 * the app root.
 */
export function TargetsSettings({
  initialTodoTarget,
  initialJournalTarget,
  isLoading,
  onSubmit,
}: TargetsSettingsProps) {
  const toast = useToast();
  const [todoTarget, setTodoTarget] = useState<number>(
    initialTodoTarget ?? DEFAULT_TODO_TARGET,
  );
  const [journalTarget, setJournalTarget] = useState<number>(
    initialJournalTarget ?? DEFAULT_JOURNAL_TARGET,
  );
  const [saving, setSaving] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState<boolean>(
    initialTodoTarget !== undefined || initialJournalTarget !== undefined,
  );

  // Hydrate once when the host's data lands. Won't overwrite the user's
  // edits if they started adjusting mid-load.
  useEffect(() => {
    if (hydrated) return;
    if (initialTodoTarget !== undefined) setTodoTarget(initialTodoTarget);
    if (initialJournalTarget !== undefined) {
      setJournalTarget(initialJournalTarget);
    }
    if (initialTodoTarget !== undefined || initialJournalTarget !== undefined) {
      setHydrated(true);
    }
  }, [initialTodoTarget, initialJournalTarget, hydrated]);

  async function save() {
    setSaving(true);
    try {
      await onSubmit({
        todoTargetDaily: todoTarget,
        journalTargetDailyWords: journalTarget,
      });
      toast.show({ title: "Targets updated", intent: "success" });
    } catch {
      toast.show({ title: "Failed to update targets", intent: "danger" });
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <Text fontSize="$3" color="$mutedForeground">
        Loading targets...
      </Text>
    );
  }

  return (
    <Form onSubmit={() => void save()} gap="$6">
      {/* Todo Target */}
      <YStack>
        <Label>Daily todo completion target</Label>
        <Text mt="$0.5" fontSize="$1" color="$mutedForeground">
          How many todos you aim to complete each day.
        </Text>
        <XStack mt="$2" items="center" gap="$2">
          {/* Definite-width wrapper: inside an auto-width ROW, the
              NumberInput's inner flex:1 value field collapses to zero
              content width on native Yoga (digits invisible — only the
              steppers' gap shows). The 150px column gives it real space;
              NumberInput has no width prop of its own. */}
          <View width={150}>
            <NumberInput
              value={todoTarget}
              onChange={setTodoTarget}
              min={1}
              max={50}
              step={1}
            />
          </View>
          <Text fontSize="$3" color="$mutedForeground">
            todos / day
          </Text>
        </XStack>
      </YStack>

      {/* Journal Target */}
      <YStack>
        <Label>Daily word count target</Label>
        <Text mt="$0.5" fontSize="$1" color="$mutedForeground">
          How many words you aim to write in your journal each day.
        </Text>
        <XStack mt="$2" items="center" gap="$2" flexWrap="wrap">
          {/* Preset picker — a compact Select scales to any number of named
              tiers without the row-cramming a ToggleGroup hits. Shows
              "Custom" whenever the value doesn't match a preset. */}
          <Select
            value={
              JOURNAL_PRESETS.some((p) => p.value === journalTarget)
                ? String(journalTarget)
                : ""
            }
            onValueChange={(v) => {
              if (v) setJournalTarget(Number(v));
            }}
          >
            <Select.Trigger width={190} placeholder="Custom" />
            <Select.Content>
              {JOURNAL_PRESETS.map((preset) => (
                <Select.Item key={preset.value} value={String(preset.value)}>
                  {`${preset.label} · ${preset.value} words`}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          {/* Same native flex-collapse guard as the todo stepper. */}
          <View width={150}>
            <NumberInput
              value={journalTarget}
              onChange={setJournalTarget}
              min={10}
              max={5000}
              step={25}
            />
          </View>
          <Text fontSize="$3" color="$mutedForeground">
            words / day
          </Text>
        </XStack>
      </YStack>

      <Form.Trigger asChild>
        <Button disabled={saving} loading={saving} loadingText="Saving…">
          Save Changes
        </Button>
      </Form.Trigger>
    </Form>
  );
}
