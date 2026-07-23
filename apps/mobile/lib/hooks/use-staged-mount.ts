// lib/hooks/use-staged-mount.ts
//
// Two-phase mount for heavy tab screens. Expo-router tabs are lazy: the
// FIRST tap on a tab mounts the whole screen synchronously on the tap frame,
// so a screen whose body is expensive (the habits card list) makes that first
// switch visibly hang. This hook lets the screen paint its cheap chrome +
// a skeleton on the tap frame and mount the real body one beat later —
// the tap responds instantly, the content shimmers in.
//
// TIMING — deliberately NOT InteractionManager.runAfterInteractions: verified
// on-simulator (2026-07-23 screenshots) that in this app the callback can
// hang for SECONDS (open interaction handles keep deferring it), which left
// the habits screen stuck on skeletons. A painted frame + a short timeout is
// the reliable primitive: rAF guarantees the skeleton actually rendered,
// the timeout yields one beat for the tab transition, then the body mounts.
//
// Runs once per mount (screens stay mounted after first visit, so later
// switches are pure native visibility flips and never see the skeleton).

import { useEffect, useState } from "react";

export function useStagedMount(delayMs = 60): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const raf = requestAnimationFrame(() => {
      timer = setTimeout(() => setReady(true), delayMs);
    });
    return () => {
      cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
    };
  }, [delayMs]);
  return ready;
}
