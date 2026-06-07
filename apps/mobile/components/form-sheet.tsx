// apps/mobile/components/form-sheet.tsx
//
// Native bottom-sheet host for create/edit forms. Renders the kit `Sheet`
// DIRECTLY — NOT `Dialog` + DialogSheetAdapt like the PWA.
//
// WHY THE DIVERGENCE (and it's only a divergence in the host, not the form):
// the PWA opens create forms via `Dialog` + an `Adapt when="max-md"` →
// `Sheet`, which TELEPORTS the dialog body into the sheet via
// `<Adapt.Contents/>`. That's fine on web. But the shared forms contain a kit
// `Select` (priority, list) whose OWN `Adapt when="max-md"` ALSO teleports to a
// sheet. On React Native, that double `Adapt.Contents` teleport breaks the
// `Select.Trigger`'s forwarded ref at render — "You attempted to set the key
// `current` … on an object that … has been frozen." Rendering the form
// DIRECTLY inside a Sheet (no outer Adapt) means the form is never teleported,
// so the inner Select is only single-nested (a Select sheet over a form sheet —
// a pattern the kit already supports, e.g. QuickDatePicker). Same bottom-sheet
// UX as the PWA, no crash.
//
// (The proper long-term fix is kit-side: harden `Select` so its Adapt survives
// being nested inside another Adapt/Sheet — then mobile could use the exact PWA
// `Dialog` + DialogSheetAdapt structure. See the kit prompt.)

import { Sheet, Text, YStack } from "@stageholder/ui";
import type { ReactNode } from "react";

interface FormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Optional sub-label under the title. */
  description?: string;
  /**
   * Sheet height as a percent of the screen. Default 85 suits long forms
   * (habit). Short forms (todo: 5 fields + buttons) pass less so the sheet
   * hugs its content instead of leaving dead space.
   */
  snapPoint?: number;
  children: ReactNode;
}

export function FormSheet({
  open,
  onOpenChange,
  title,
  description,
  snapPoint = 85,
  children,
}: FormSheetProps) {
  return (
    <Sheet
      modal
      open={open}
      onOpenChange={onOpenChange}
      dismissOnSnapToBottom
      // PERCENT snap, NOT snapPointsMode="fit": fit + Sheet.ScrollView
      // mis-measures on native and the sheet shoots to FULL SCREEN, pinned
      // to the very top (same `fit` mismeasure class the kit Select's
      // nested sheet hit — see @stageholder/ui Select.tsx NestedSelectSheet
      // comments). 85% keeps the status bar + a sliver of the screen behind
      // visible like a standard form sheet, with headroom for the keyboard.
      snapPoints={[snapPoint]}
      transition="medium"
    >
      <Sheet.Overlay />
      <Sheet.Frame px={0} pt="$2" pb="$5" gap="$2">
        <Sheet.ScrollView>
          {/* Horizontal padding lives inside the ScrollView (not the Frame)
              so input focus rings / borders don't clip at the edges. The
              single column keeps the form full-width. */}
          <YStack px="$5" gap="$4" width="100%">
            <YStack gap="$1">
              <Text fontSize="$7" fontWeight="600" color="$cardForeground">
                {title}
              </Text>
              {description ? (
                <Text fontSize="$3" color="$mutedForeground">
                  {description}
                </Text>
              ) : null}
            </YStack>
            {children}
          </YStack>
        </Sheet.ScrollView>
      </Sheet.Frame>
    </Sheet>
  );
}
