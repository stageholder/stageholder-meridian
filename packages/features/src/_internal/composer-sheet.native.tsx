// packages/features/src/_internal/composer-sheet.native.tsx  (NATIVE)
//
// The quick-add composer's sheet shell — a thin, app-owned frame over the kit
// `Sheet`, replacing the kit `FormSheet` for this one surface.
//
// Why not FormSheet: its keyboard spacer only starts tracking the keyboard
// AFTER the open spring has settled (a guard from the WebView-editor era).
// The composer autofocuses a native input the moment it opens, so the
// keyboard was already rising while the sheet slid in, and the sheet landed
// low and then jumped up once the slide finished. Here the spacer follows the
// keyboard from the first frame, so sheet and keyboard arrive together.
//
// Everything else is the FormSheet recipe the composer relied on: modal, no
// drag (it closes via overlay tap / the host), `fit` sizing (content directly
// in the frame — never a ScrollView), the `medium` spring, children mounted
// at open and unmounted at close (the field goes with the sheet so the
// keyboard drops by itself), and `onSettled` forwarded for the hosts' nested
// pickers.
//
// RESET CONTRACT: this shell stays mounted for the host's lifetime; the
// per-open state lives in its CHILDREN, which the `open` policy unmounts at
// close and mounts fresh at open. Remounting the shell itself per open (a
// keyed instance) left nested picker sheets with an overlay but no frame on
// the second open (Tamagui portal order, 2026-10-25) — never key the shell.

import type { ReactNode } from "react";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import { Sheet, YStack } from "@stageholder/ui";

import { useAndroidBackClose } from "./use-android-back-close";

/** Frame chrome below the content (pb $4 + the frame's gap) that the spacer
 *  trims, so the pill row sits a few px above the keys, not a full gap. */
const BOTTOM_CHROME = 28;

export interface ComposerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Kit Sheet `onSettled`: fires once per OPEN (never on close — the kit's
   *  settle store resets on close without firing). */
  onSettled?: () => void;
  children: ReactNode;
}

/**
 * Bottom spacer that tracks the keyboard frame-by-frame (keyboard-controller's
 * native frame on the UI thread, negative on iOS hence abs — not RN's
 * `Keyboard` events, which go stale across a composer→detail focus handoff).
 * Last child of a `fit` sheet frame: the sheet grows with the keyboard from
 * the first frame and collapses as it falls. Nested picker/menu sheets use it
 * too, so they open ABOVE a keyboard that stays up — dismissing the keyboard
 * on the way to a nested sheet collapsed the parent mid-open and the nested
 * frame never placed (2026-10-25).
 */
export function KeyboardSpacer({
  chrome = BOTTOM_CHROME,
}: {
  chrome?: number;
}) {
  const { height: kbHeight } = useReanimatedKeyboardAnimation();
  const spacerStyle = useAnimatedStyle(() => {
    const h = Math.abs(kbHeight.value);
    return { height: h > 0 ? Math.max(0, h - chrome) : 0 };
  });
  return <Animated.View style={spacerStyle} />;
}

export function ComposerSheet({
  open,
  onOpenChange,
  onSettled,
  children,
}: ComposerSheetProps) {
  // Android hardware back closes this sheet (not the navigator beneath it).
  useAndroidBackClose(open, () => onOpenChange(false));

  return (
    <Sheet
      modal
      open={open}
      onOpenChange={onOpenChange}
      transition="medium"
      disableDrag
      dismissOnSnapToBottom={false}
      snapPointsMode="fit"
      disableRemoveScroll
      mountChildren="open"
      {...(onSettled ? { onSettled } : {})}
    >
      <Sheet.Overlay />
      {/* Compact frame (the 2026-10-20 spec): the field right under the sheet
          edge, pills a few px above the keys. `disableHideBottomOverflow`
          false keeps the kit's $card cover below the frame, so a frame that
          shrinks a beat behind a falling keyboard never exposes the page. */}
      <Sheet.Frame
        handle={false}
        pt="$3"
        px="$5"
        pb="$4"
        gap="$4"
        disableHideBottomOverflow={false}
      >
        <YStack gap="$3">{children}</YStack>
        <KeyboardSpacer />
      </Sheet.Frame>
    </Sheet>
  );
}
