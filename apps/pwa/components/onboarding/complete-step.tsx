"use client";

import { useState } from "react";
import { Check } from "lucide-react";

export function CompleteStep({ onFinish }: { onFinish: () => void }) {
  const [loading, setLoading] = useState(false);

  function handleFinish() {
    setLoading(true);
    onFinish();
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
          Your workspace is ready. Start building habits, tracking tasks, and
          journaling your journey.
        </p>
      </div>
      <button
        onClick={handleFinish}
        disabled={loading}
        className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {loading ? "Loading..." : "Go to Dashboard"}
      </button>
    </div>
  );
}
