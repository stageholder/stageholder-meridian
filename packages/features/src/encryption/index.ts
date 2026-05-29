// Barrel for the `encryption` domain — presentational dialogs for the
// passphrase unlock + setup flow. The host app owns the store wiring
// (`useEncryptionStore` on the PWA, the equivalent on mobile) and
// supplies `onUnlock`/`onSetup` callbacks that call into the store.
//
// The orchestrating `<EncryptionGate>` and its floating `<SetupBanner>`
// stay per-app — the gate is store-driven (PWA: zustand, mobile: same
// zustand store via a per-app sibling), and the banner uses
// `position:"fixed"` on web vs. a kit `Sheet` on mobile, so each app
// composes the lifted dialogs into its own gate.

export {
  PassphrasePrompt,
  type PassphrasePromptProps,
} from "./passphrase-prompt";

export {
  PassphraseSetupDialog,
  type PassphraseSetupDialogProps,
} from "./passphrase-setup-dialog";
