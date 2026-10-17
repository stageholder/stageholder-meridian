// packages/features/src/encryption/passphrase-input-props.ts
//
// Keyboard/autofill props for passphrase fields. On native the kit Input is
// an RN TextInput, and Tamagui's <Form> does NOT turn the Return key into a
// submit there — without `onSubmitEditing` Return did nothing. Native-only
// props are gated on `isWeb` so the DOM never sees RN-only attributes.
//
// `kind: "new"` maps to iOS `newPassword` / `new-password`, which lets the OS
// offer to SAVE the passphrase to Keychain / the password manager — a lost
// passphrase means unrecoverable journal entries, so this matters.

import { isWeb } from "tamagui";

export function passphraseInputProps({
  kind,
  last,
  onSubmit,
}: {
  kind: "current" | "new";
  /** Last field in the form: Return submits instead of moving on. */
  last: boolean;
  onSubmit?: () => void;
}) {
  const isNew = kind === "new";
  const common = {
    autoCapitalize: "none" as const,
    autoCorrect: false,
    autoComplete: isNew
      ? ("new-password" as const)
      : ("current-password" as const),
  };
  if (isWeb) return common;
  return {
    ...common,
    textContentType: isNew ? ("newPassword" as const) : ("password" as const),
    returnKeyType: last ? ("done" as const) : ("next" as const),
    onSubmitEditing: last ? onSubmit : undefined,
  };
}
