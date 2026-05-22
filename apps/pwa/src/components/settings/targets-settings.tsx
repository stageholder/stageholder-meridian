import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Button,
  Label,
  NumberInput,
  Text,
  XStack,
  YStack,
} from "@stageholder/ui";
import { useUserLight, useUpdateTargets } from "@/lib/api/light";

const JOURNAL_PRESETS = [
  { label: "Quick", value: 50 },
  { label: "Standard", value: 75 },
  { label: "Moderate", value: 150 },
  { label: "Deep", value: 250 },
  { label: "Extensive", value: 500 },
] as const;

export function TargetsSettings() {
  const { data: userLight, isLoading } = useUserLight();
  const updateTargets = useUpdateTargets();

  const [todoTarget, setTodoTarget] = useState(3);
  const [journalTarget, setJournalTarget] = useState(75);

  useEffect(() => {
    if (userLight) {
      setTodoTarget(userLight.todoTargetDaily);
      setJournalTarget(userLight.journalTargetDailyWords);
    }
  }, [userLight]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateTargets.mutate(
      { todoTargetDaily: todoTarget, journalTargetDailyWords: journalTarget },
      {
        onSuccess: () => toast.success("Targets updated"),
        onError: () => toast.error("Failed to update targets"),
      },
    );
  }

  if (isLoading) {
    return (
      <Text fontSize="$3" color="$mutedForeground">
        Loading targets...
      </Text>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <YStack gap="$6">
        {/* Todo Target */}
        <YStack>
          <Label>Daily todo completion target</Label>
          <Text mt="$0.5" fontSize="$1" color="$mutedForeground">
            How many todos you aim to complete each day.
          </Text>
          <XStack mt="$2" items="center" gap="$2">
            <NumberInput
              value={todoTarget}
              onChange={setTodoTarget}
              min={1}
              max={50}
              step={1}
            />
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
          <XStack mt="$2" flexWrap="wrap" gap="$2">
            {JOURNAL_PRESETS.map((preset) => {
              const active = journalTarget === preset.value;
              return (
                <XStack
                  key={preset.value}
                  tag="button"
                  type="button"
                  onPress={() => setJournalTarget(preset.value)}
                  cursor="pointer"
                  rounded="$lg"
                  borderWidth={1}
                  px="$3"
                  py="$1.5"
                  borderColor={active ? "$primary" : "$borderColor"}
                  bg={active ? "$primaryMuted" : "$background"}
                  transition="quick"
                  hoverStyle={active ? undefined : { bg: "$accent" }}
                >
                  <Text
                    fontSize="$3"
                    fontWeight="500"
                    color={active ? "$primary" : "$mutedForeground"}
                  >
                    {preset.label} ({preset.value})
                  </Text>
                </XStack>
              );
            })}
          </XStack>
          <XStack mt="$2" items="center" gap="$2">
            <NumberInput
              value={journalTarget}
              onChange={setJournalTarget}
              min={10}
              max={5000}
              step={25}
            />
            <Text fontSize="$3" color="$mutedForeground">
              words / day
            </Text>
          </XStack>
        </YStack>

        <Button
          type="submit"
          disabled={updateTargets.isPending}
          loading={updateTargets.isPending}
          loadingText="Saving…"
        >
          Save Changes
        </Button>
      </YStack>
    </form>
  );
}
