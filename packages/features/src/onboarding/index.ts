// Barrel for the `onboarding` domain — pure presentational wizard steps.
// Each step takes its data + advancement callback via props; the host app
// (PWA today, mobile later) owns the wizard state machine, profile saving,
// and routing.

export { WelcomeStep } from "./welcome-step";
export { GoalsStep } from "./goals-step";
export { CompleteStep } from "./complete-step";
export { TourStep } from "./tour-step";
export { ProfileStep, type ProfileStepProps } from "./profile-step";
