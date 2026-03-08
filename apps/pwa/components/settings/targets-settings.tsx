"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useUserLight, useUpdateTargets } from "@/lib/api/light";
import { cn } from "@/lib/utils";

const JOURNAL_PRESETS = [
  { label: "Quick", value: 50 },
  { label: "Standard", value: 150 },
  { label: "Deep", value: 250 },
  { label: "Extensive", value: 500 },
] as const;

export function TargetsSettings() {
  const { data: userLight, isLoading } = useUserLight();
  const updateTargets = useUpdateTargets();

  const [todoTarget, setTodoTarget] = useState(3);
  const [journalTarget, setJournalTarget] = useState(150);

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
    return <div className="text-sm text-muted-foreground">Loading targets...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Todo Target */}
      <div>
        <label className="block text-sm font-medium text-foreground">
          Daily todo completion target
        </label>
        <p className="mt-0.5 text-xs text-muted-foreground">
          How many todos you aim to complete each day.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTodoTarget(Math.max(1, todoTarget - 1))}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-foreground hover:bg-muted"
          >
            -
          </button>
          <input
            type="number"
            min={1}
            max={50}
            value={todoTarget}
            onChange={(e) => setTodoTarget(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
            className="h-9 w-16 rounded-lg border border-border bg-background px-2 text-center text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="button"
            onClick={() => setTodoTarget(Math.min(50, todoTarget + 1))}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-foreground hover:bg-muted"
          >
            +
          </button>
          <span className="text-sm text-muted-foreground">todos / day</span>
        </div>
      </div>

      {/* Journal Target */}
      <div>
        <label className="block text-sm font-medium text-foreground">
          Daily word count target
        </label>
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
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              )}
            >
              {preset.label} ({preset.value})
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            min={10}
            max={5000}
            value={journalTarget}
            onChange={(e) => setJournalTarget(Math.min(5000, Math.max(10, parseInt(e.target.value) || 10)))}
            className="h-9 w-24 rounded-lg border border-border bg-background px-2 text-center text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <span className="text-sm text-muted-foreground">words / day</span>
        </div>
      </div>

      <button
        type="submit"
        disabled={updateTargets.isPending}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {updateTargets.isPending ? "Saving..." : "Save Changes"}
      </button>
    </form>
  );
}
