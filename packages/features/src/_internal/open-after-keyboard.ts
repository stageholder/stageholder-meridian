// Web counterpart of open-after-keyboard.native.ts: no software keyboard to
// wait for — open at once.
export function openAfterKeyboard(set: (open: boolean) => void) {
  set(true);
}
