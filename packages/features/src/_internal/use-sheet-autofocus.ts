// src/_internal/use-sheet-autofocus.ts
//
// Deferred autofocus for form fields that mount inside an animating bottom
// Sheet on native. A plain `autoFocus` fires at mount — which, with the kit
// Sheet's lazy content mounting, is the exact frame the sheet's slide-up
// spring starts. That stacked the keyboard animation + form mount + sheet
// spring on one frame and made every FAB-opened sheet feel slow.
//
// Same principle as the kit's internal `useSettleAfterOpen` (alpha.120's
// picker fix): a Reanimated spring does NOT register with InteractionManager,
// so `runAfterInteractions` fires mid-slide — a short timer keyed to the open
// transition is what actually clears it. 400ms covers the kit's
// `transition="medium"` sheet slide with a little settle room.
//
// Usage (the host form mounts fresh each open — kit sheets unmount content
// while closed, so the effect runs exactly once per open):
//
//   const titleRef = useSheetAutoFocus<SmartTodoInputHandle>();
//   <SmartTodoInput ref={titleRef} autoFocus={isWeb} … />
//
// Web returns an inert ref and does nothing — web dialogs have no native
// spring to protect, and the field keeps its plain `autoFocus`.

import { useEffect, useRef } from "react";
import { isWeb } from "tamagui";

export interface Focusable {
  focus?: () => void;
}

export function useSheetAutoFocus<T extends Focusable>(delayMs = 400) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    if (isWeb) return;
    const t = setTimeout(() => ref.current?.focus?.(), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);
  return ref;
}
