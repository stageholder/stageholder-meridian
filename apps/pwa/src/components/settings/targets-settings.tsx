import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button, Label, NumberInput } from "@stageholder/ui";
import { useUserLight, useUpdateTargets } from "@/lib/api/light";
import { cn } from "@/lib/utils";

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
      <div className="text-sm text-muted-foreground">Loading targets...</div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Todo Target */}
      <div>
        <Label>Daily todo completion target</Label>
        <p className="mt-0.5 text-xs text-muted-foreground">
          How many todos you aim to complete each day.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <NumberInput
            value={todoTarget}
            onChange={setTodoTarget}
            min={1}
            max={50}
            step={1}
          />
          <span className="text-sm text-muted-foreground">todos / day</span>
        </div>
      </div>

      {/* Journal Target */}
      <div>
        <Label>Daily word count target</Label>
        <p className="mt-0.5 text-xs text-muted-foreground">
          How many words you aim to write in your journal each day.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {JOURNAL_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => setJournalTarget(preset.value)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                journalTarget === preset.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {preset.label} ({preset.value})
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <NumberInput
            value={journalTarget}
            onChange={setJournalTarget}
            min={10}
            max={5000}
            step={25}
          />
          <span className="text-sm text-muted-foreground">words / day</span>
        </div>
      </div>

      <Button
        type="submit"
        disabled={updateTargets.isPending}
        loading={updateTargets.isPending}
        loadingText="Saving…"
      >
        Save Changes
      </Button>
    </form>
  );
}
