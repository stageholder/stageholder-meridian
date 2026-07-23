// src/_internal/use-sheet-autofocus.ts
//
// Deferred autofocus for form fields that mount inside an animating bottom
// Sheet on native. A plain `autoFocus` fires at mount — the exact frame the
// sheet's slide-up spring starts — stacking the keyboard animation + form
// mount + sheet spring on one frame.
//
// alpha.121: gates on the kit's `useSheetSettled()` — the Sheet's REAL
// "open spring completed" signal (`onAnimationComplete`, capped at ~350ms) —
// instead of the old bare timer, which raced a delayed spring (the reason the
// kit deprecated its own `useSettleAfterOpen` for Sheet hosts). Outside a
// Sheet the kit hook degrades to "settled immediately".
//
// Usage (the host form mounts fresh each open — keyed by an open epoch —
// so the effect runs exactly once per open):
//
//   const titleRef = useSheetAutoFocus<SmartTodoInputHandle>();
//   <SmartTodoInput ref={titleRef} autoFocus={isWeb} … />
//
// Web returns an inert ref and does nothing — web dialogs have no native
// spring to protect, and the field keeps its plain `autoFocus`.

import { useEffect, useRef } from "react";
import { isWeb } from "tamagui";
import { useSheetSettled } from "@stageholder/ui";

export interface Focusable {
  focus?: () => void;
}

export function useSheetAutoFocus<T extends Focusable>(bufferMs = 50) {
  const ref = useRef<T | null>(null);
  const settled = useSheetSettled();
  useEffect(() => {
    if (isWeb || !settled) return;
    // Tiny buffer past the settle signal so summoning the keyboard never
    // clips the spring's last frames.
    const t = setTimeout(() => ref.current?.focus?.(), bufferMs);
    return () => clearTimeout(t);
  }, [settled, bufferMs]);
  return ref;
}
