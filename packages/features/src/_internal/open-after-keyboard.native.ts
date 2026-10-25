// packages/features/src/_internal/open-after-keyboard.native.ts  (NATIVE)
//
// Open a FULL-HEIGHT picker (the kit MediaPickerSheet) only once the host's
// keyboard is down. That sheet is the kit's own, so it cannot carry the app's
// keyboard spacer like the nested pill/date/menu sheets do — opened under a
// standing keyboard it was buried behind the keys (device feedback
// 2026-10-25). It has its own search field for when the keyboard is wanted.
//
// The keyboard here was raised by the host's own field, so RN's keyboard
// events are fresh (unlike a composer→detail focus handoff): wait for
// `keyboardDidHide` when a keyboard is up; with a focused field but no
// software keyboard (hardware keyboard) just blur and open; otherwise open
// at once. No timers.

import { Keyboard, TextInput } from "react-native";

export function openAfterKeyboard(set: (open: boolean) => void) {
  const focused = TextInput.State.currentlyFocusedInput();
  if (!focused) {
    set(true);
    return;
  }
  if (!Keyboard.isVisible()) {
    TextInput.State.blurTextInput(focused);
    set(true);
    return;
  }
  const sub = Keyboard.addListener("keyboardDidHide", () => {
    sub.remove();
    set(true);
  });
  Keyboard.dismiss();
}
