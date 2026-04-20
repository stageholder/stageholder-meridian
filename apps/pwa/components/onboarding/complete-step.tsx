"use client";

import { useState } from "react";
import { Check } from "lucide-react";

export function CompleteStep({ onFinish }: { onFinish: () => Promise<void> }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFinish() {
    setError(null);
    setLoading(true);
    try {
      await onFinish();
    } catch {
      setError("We couldn't save that. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center text-center space-y-6">
      <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
        <Check className="size-8 text-primary" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-foreground">
          You&apos;re all set!
        </h2>
        <p className="text-muted-foreground">
          You&apos;re ready to go. Start building habits, tracking tasks, and
          journaling your journey.
        </p>
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <button
        onClick={handleFinish}
        disabled={loading}
        className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {loading ? "Saving..." : "Go to Dashboard"}
      </button>
    </div>
  );
}
