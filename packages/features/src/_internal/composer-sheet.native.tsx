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

import type { ReactNode } from "react";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import { Sheet, YStack } from "@stageholder/ui";

/** Frame chrome below the content (pb $4 + the frame's gap) that the spacer
 *  trims, so the pill row sits a few px above the keys, not a full gap. */
const BOTTOM_CHROME = 28;

export interface ComposerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Kit Sheet `onSettled`: fires once per open AND once per close. */
  onSettled?: () => void;
  children: ReactNode;
}

export function ComposerSheet({
  open,
  onOpenChange,
  onSettled,
  children,
}: ComposerSheetProps) {
  // Keyboard height as a Reanimated shared value — tracks the keyboard
  // frame-by-frame on the UI thread (negative on iOS, hence abs). The spacer
  // grows the `fit` frame in lockstep with the keyboard rising, from the very
  // first frame, and collapses as it falls.
  const { height: kbHeight } = useReanimatedKeyboardAnimation();
  const spacerStyle = useAnimatedStyle(() => {
    const h = Math.abs(kbHeight.value);
    return { height: h > 0 ? Math.max(0, h - BOTTOM_CHROME) : 0 };
  });

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
        <Animated.View style={spacerStyle} />
      </Sheet.Frame>
    </Sheet>
  );
}
