"use client";

import { ProfileSettings } from "@stageholder/sdk/react";

/**
 * Profile editor for the Settings → Profile tab. Hub is the source of
 * truth for these fields; the SDK component handles fetch, optimistic
 * pending state, validation-error surfacing, and cross-tab cache sync.
 *
 * `phoneNumber` is hidden — Meridian doesn't surface phone-based notifications,
 * so the field would just be unused noise. Re-enable by removing it from
 * `hideFields` if/when Meridian adds phone-tied features.
 */
export function ProfileForm() {
  return <ProfileSettings hideFields={["phoneNumber"]} />;
}
