"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";
import { WelcomeStep } from "@/components/onboarding/welcome-step";
import { ProfileStep } from "@/components/onboarding/profile-step";
import { GoalsStep } from "@/components/onboarding/goals-step";
import { TourStep } from "@/components/onboarding/tour-step";
import { FirstActionStep } from "@/components/onboarding/first-action-step";
import { CompleteStep } from "@/components/onboarding/complete-step";
import type { AuthUser } from "@repo/core/types";

const TOTAL_STEPS = 6;

export default function OnboardingPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [step, setStep] = useState(0);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);

  useEffect(() => {
    if (!user) {
      router.replace("/login");
    } else if (user.onboardingCompleted) {
      router.replace(`/${user.personalWorkspaceShortId}/dashboard`);
    }
  }, [user, router]);

  const finishOnboarding = useCallback(async () => {
    try {
      const res = await apiClient.post<AuthUser>("/auth/onboarding/complete");
      setUser(res.data);
      router.push(`/${res.data.personalWorkspaceShortId}/dashboard`);
    } catch {
      // fallback: just redirect
      if (user?.personalWorkspaceShortId) {
        router.push(`/${user.personalWorkspaceShortId}/dashboard`);
      }
    }
  }, [setUser, router, user]);

  const handleSkip = useCallback(() => {
    void finishOnboarding();
  }, [finishOnboarding]);

  if (!user || user.onboardingCompleted) return null;

  const stepComponent = (() => {
    switch (step) {
      case 0:
        return <WelcomeStep name={user.name} onContinue={() => setStep(1)} />;
      case 1:
        return <ProfileStep onContinue={() => setStep(2)} />;
      case 2:
        return (
          <GoalsStep
            selectedGoals={selectedGoals}
            onGoalsChange={setSelectedGoals}
            onContinue={() => setStep(3)}
          />
        );
      case 3:
        return <TourStep selectedGoals={selectedGoals} onContinue={() => setStep(4)} />;
      case 4:
        return (
          <FirstActionStep
            selectedGoals={selectedGoals}
            personalWorkspaceShortId={user.personalWorkspaceShortId}
            onContinue={() => setStep(5)}
            onSkip={() => setStep(5)}
          />
        );
      case 5:
        return <CompleteStep onFinish={finishOnboarding} />;
      default:
        return null;
    }
  })();

  return (
    <div className="space-y-8">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "size-2 rounded-full transition-colors",
              i === step ? "bg-primary" : i < step ? "bg-primary/40" : "bg-muted-foreground/20",
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
          {step > 0 && step < 5 && (
            <button
              onClick={() => setStep(step - 1)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Back
            </button>
          )}
        </div>
        {step < 5 && (
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
