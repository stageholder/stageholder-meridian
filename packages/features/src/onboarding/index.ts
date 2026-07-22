// Barrel for the `onboarding` domain — the Meridian onboarding wizard, built
// on the kit's config-driven `Onboarding` component. The host owns only the
// data + side effects (profile fetch, completion, routing); the wizard owns
// the steps + structure. (The old per-step components + hand-rolled shells
// were replaced by this — see onboarding-wizard.tsx.)

export {
  OnboardingWizard,
  ONBOARDING_STEP_IDS,
  type OnboardingWizardProps,
  type OnboardingProfileValue,
} from "./onboarding-wizard";
