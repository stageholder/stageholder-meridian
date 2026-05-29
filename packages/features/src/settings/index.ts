// Barrel for the `settings` domain — shared form components for the
// settings + onboarding surfaces. Each view takes its data + a single
// `onSubmit` callback; the host owns the SDK/store wiring.

export { TimezoneSelect, type TimezoneSelectProps } from "./timezone-select";

export { ProfileForm, type ProfileFormProps } from "./profile-form";

export { TargetsSettings, type TargetsSettingsProps } from "./targets-settings";
