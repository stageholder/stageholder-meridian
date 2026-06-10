import { useState } from "react";
import { Dialog, XStack, YStack } from "@stageholder/ui";
import { Shield } from "@tamagui/lucide-icons-2";

import {
  PASSPHRASE_SETUP_COPY,
  PassphraseSetupForm,
  type PassphraseSetupStep,
} from "./passphrase-setup-form";

export interface PassphraseSetupDialogProps {
  /** Controls dialog visibility. */
  open: boolean;
  /**
   * Called when the dialog should close — both on successful flow finish
   * (Done) AND on user-initiated cancel. The host's gate typically just
   * flips its local `showSetup` state to false either way, so a single
   * callback is sufficient.
   */
  onComplete: () => void;
  /**
   * Generate the user's encryption key + return the recovery codes they
   * must save (typically 8-12 short strings). The view advances to the
   * "show recovery codes" step on resolve. Throwing surfaces via
   * `onSetupError` (the host typically shows a toast).
   */
  onSetup: (passphrase: string) => Promise<string[]>;
  /** Called when `onSetup` throws. Host usually surfaces a toast. */
  onSetupError?: (err: unknown) => void;
}

/**
 * The two-step setup wizard (`PassphraseSetupForm`) hosted in a kit
 * `Dialog` — the PWA surface. Mobile hosts the same form in a kit
 * `FormSheet` instead (apps/mobile journal screen), matching its other
 * create/edit flows.
 */
export function PassphraseSetupDialog({
  open,
  onComplete,
  onSetup,
  onSetupError,
}: PassphraseSetupDialogProps) {
  // Mirror of the form's internal step — drives which Dialog.Title /
  // Description pair renders above the form content.
  const [step, setStep] = useState<PassphraseSetupStep>("create");
  const copy = PASSPHRASE_SETUP_COPY[step];

  return (
    // disableRemoveScroll: the kit's modal scroll-lock sets overflow:hidden +
    // scrollbar-gutter:stable on <html>, but this PWA scrolls in an inner
    // container (app-shell's <main>), so the lock just reserves a phantom
    // gutter and shifts the background when the dialog opens. The full-screen
    // scrim already blocks background interaction, so the lock is redundant.
    <Dialog open={open} disableRemoveScroll>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content
          maxW={448}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <YStack gap="$2">
            {step === "create" ? (
              // The Shield icon lives in its own flex row above Dialog.Title,
              // instead of inside Title with flex+gap. Tamagui's Dialog.Title
              // renders as an inline-ish Text on web — putting Description as
              // its sibling caused the two to render on the same line.
              <XStack items="center" gap="$2">
                {/* lucide-icons-2 reads its own `color` (no CSS cascade) —
                    tint the icon directly. */}
                <Shield size={20} color="$cardForeground" />
                <Dialog.Title>{copy.title}</Dialog.Title>
              </XStack>
            ) : (
              <Dialog.Title>{copy.title}</Dialog.Title>
            )}
            <Dialog.Description>{copy.description}</Dialog.Description>
          </YStack>
          <PassphraseSetupForm
            onComplete={onComplete}
            onSetup={onSetup}
            onSetupError={onSetupError}
            onStepChange={setStep}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
