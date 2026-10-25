// packages/features/src/_internal/open-after-keyboard.native.ts  (NATIVE)
//
// Open a picker / menu sheet only once the host's keyboard is down. The
// pickers can rise above a keyboard (they carry the app's spacer), but a
// keyboard standing behind an option list reads as unstable ("why is the
// keyboard still up?", device feedback 2026-10-25), so every pill, date and
// "⋯" opener goes through here. Opening AFTER `keyboardDidHide` (not in the
// same tick as the dismiss) is what keeps the parent sheet's collapse and
// the nested sheet's open from racing.
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
