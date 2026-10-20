// packages/features/src/_internal/accent-button-press.ts
//
// Hover/press styling for a kit `Button` whose background is a RAW accent
// color (habit accent, todo red) rather than an intent token.
//
// WEB ONLY by design. On native the kit Button is a react-native-gesture-handler
// Pressable (kit ≥ 0.4.0-alpha.1, 2026-10-12) wrapping a Tamagui frame, and a
// `pressStyle` on that frame makes Tamagui attach the RN responder handlers to
// it. The moment the frame becomes the JS responder, gesture-handler's root
// recognizer blocks every other recognizer (RNGestureHandlerManager
// `handleSetJSResponder` → `blockOtherRecognizers`), so the Pressable's own
// press gesture is cancelled and `onPress` never fires — the habit "Check In"
// button was dead on iOS (2026-10-20) while the neighbouring IconButtons, which
// pass no `pressStyle`, worked. The kit Button already gives native its own
// press feedback (spring scale + opacity), so nothing is lost by omitting it.
import { isWeb } from "tamagui";

export function accentButtonPressProps(accentColor: string) {
  return isWeb
    ? {
        hoverStyle: { backgroundColor: accentColor, opacity: 0.9 } as never,
        pressStyle: { backgroundColor: accentColor, opacity: 0.82 } as never,
      }
    : {};
}
