import { z } from "zod";

/**
 * Marker schema for `POST /me/onboarding/complete`. The endpoint takes no
 * body — onboarding is purely a state transition on the Meridian-side
 * `users.has_completed_onboarding` flag. Per-account timezone lives on the
 * Stageholder Hub profile and is written via the SDK's `useUpdateProfile`,
 * not here.
 */
export const CompleteOnboardingDto = z.object({}).strict();
export type CompleteOnboardingDto = z.infer<typeof CompleteOnboardingDto>;
