"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { cn } from "@/lib/utils";
import { WelcomeStep } from "@/components/onboarding/welcome-step";
import { ProfileStep } from "@/components/onboarding/profile-step";
import { GoalsStep } from "@/components/onboarding/goals-step";
import { TourStep } from "@/components/onboarding/tour-step";
import { CompleteStep } from "@/components/onboarding/complete-step";

const TOTAL_STEPS = 5;

async function postCompletion(timezone: string): Promise<void> {
  const res = await fetch("/api/me/onboarding/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ timezone }),
  });
  if (!res.ok) {
    throw new Error(`completion failed: ${res.status}`);
  }
}

export default function OnboardingPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoading } = useUser();
  const [step, setStep] = useState(0);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [timezone, setTimezone] = useState<string>(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  );

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/auth/login");
      return;
    }
    // Already onboarded — don't let the user re-enter the flow by typing
    // the URL. The layout gate handles the inverse (not-onboarded hitting
    // /app) so /onboarding and /app are now fully separated lanes.
    if (user.hasCompletedOnboarding) {
      router.replace("/app");
    }
  }, [user, isLoading, router]);

  // Throws on failure — CompleteStep catches and surfaces the inline error.
  const finishOnboarding = useCallback(async () => {
    await postCompletion(timezone);
    await queryClient.invalidateQueries({ queryKey: ["me"] });
    router.push("/app");
  }, [timezone, queryClient, router]);

  const handleSkip = useCallback(async () => {
    try {
      await postCompletion(timezone);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      router.push("/app");
    } catch {
      // Skip failed. Intentionally silent — CompleteStep is the primary
      // error surface; the user can finish the flow normally or retry skip.
    }
  }, [timezone, queryClient, router]);

  if (!user) return null;

  const stepComponent = (() => {
    switch (step) {
      case 0:
        return (
          <WelcomeStep name={user.name ?? ""} onContinue={() => setStep(1)} />
        );
      case 1:
        return (
          <ProfileStep
            timezone={timezone}
            onTimezoneChange={setTimezone}
            onContinue={() => setStep(2)}
          />
        );
      case 2:
        return (
          <GoalsStep
            selectedGoals={selectedGoals}
            onGoalsChange={setSelectedGoals}
            onContinue={() => setStep(3)}
          />
        );
      case 3:
        return (
          <TourStep
            selectedGoals={selectedGoals}
            onContinue={() => setStep(4)}
          />
        );
      case 4:
        return <CompleteStep onFinish={finishOnboarding} />;
      default:
        return null;
    }
  })();

  const lastStep = TOTAL_STEPS - 1;

  return (
    <div className="space-y-8">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "size-2 rounded-full transition-colors",
              i === step
                ? "bg-primary"
                : i < step
                  ? "bg-primary/40"
                  : "bg-muted-foreground/20",
            )}
          />
        ))}
      </div>

      {/* Step content */}
      <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
        {stepComponent}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div>
          {step > 0 && step < lastStep && (
            <button
              onClick={() => setStep(step - 1)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Back
            </button>
          )}
        </div>
        {step < lastStep && (
          <button
            onClick={handleSkip}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip setup
          </button>
        )}
      </div>
    </div>
  );
}
