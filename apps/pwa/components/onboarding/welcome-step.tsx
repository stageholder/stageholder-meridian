"use client";

export function WelcomeStep({
  name,
  onContinue,
}: {
  name: string;
  onContinue: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-foreground">
          Welcome to Meridian, {name.split(" ")[0]}!
        </h2>
        <p className="text-muted-foreground">
          Your personal productivity companion for tasks, habits, journaling,
          and more. Let&apos;s get you set up in just a few steps.
        </p>
      </div>
      <button
        onClick={onContinue}
        className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Get Started
      </button>
    </div>
  );
}
