import { useState, useCallback, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";
import { WelcomeStep } from "@/components/onboarding/welcome-step";
import { ProfileStep } from "@/components/onboarding/profile-step";
import { GoalsStep } from "@/components/onboarding/goals-step";
import { TourStep } from "@/components/onboarding/tour-step";
import { CompleteStep } from "@/components/onboarding/complete-step";

export const Route = createFileRoute("/_auth/onboarding")({
  component: OnboardingPage,
});

const TOTAL_STEPS = 5;

async function postCompletion(): Promise<void> {
  // Hits the Meridian API directly via the SPA-backed apiClient (Bearer +
  // transparent refresh handled by the SDK). The old BFF `/api/me/onboarding/complete`
  // route is gone — there's no server hop between the SPA and the API.
  await apiClient.post("/me/onboarding/complete", {});
}

function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isLoading } = useUser();
  const [step, setStep] = useState(0);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate({ to: "/auth/login" });
      return;
    }
    // Already onboarded — don't let the user re-enter the flow by typing
    // the URL. The _app gate handles the inverse (not-onboarded hitting
    // /) so /onboarding and the app shell are fully separated lanes.
    if (user.hasCompletedOnboarding) {
      navigate({ to: "/" });
    }
  }, [user, isLoading, navigate]);

  // Throws on failure — CompleteStep catches and surfaces the inline error.
  const finishOnboarding = useCallback(async () => {
    await postCompletion();
    // Invalidate the meta query so the _app `beforeLoad` gate re-evaluates
    // and routes the user into the shell instead of bouncing back here.
    await queryClient.invalidateQueries({
      queryKey: ["meridian-user-meta", user?.sub],
    });
    navigate({ to: "/" });
  }, [queryClient, navigate, user?.sub]);

  const handleSkip = useCallback(async () => {
    try {
      await postCompletion();
      await queryClient.invalidateQueries({
        queryKey: ["meridian-user-meta", user?.sub],
      });
      navigate({ to: "/" });
    } catch {
      // Skip failed. Intentionally silent — CompleteStep is the primary
      // error surface; the user can finish the flow normally or retry skip.
    }
  }, [queryClient, navigate, user?.sub]);

  if (!user) return null;

  const stepComponent = (() => {
    switch (step) {
      case 0:
        return (
          <WelcomeStep name={user.name ?? ""} onContinue={() => setStep(1)} />
        );
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
    // Centered, constrained shell so onboarding doesn't stretch edge-to-edge
    // on wide viewports. The _auth zone has no parent layout (it's the
    // unauth lane), so this page owns its own viewport chrome.
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl space-y-8">
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
    </div>
  );
}
