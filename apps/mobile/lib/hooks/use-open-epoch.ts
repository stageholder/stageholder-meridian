// lib/hooks/use-open-epoch.ts
//
// Remount key for form content hosted in a kit Sheet: increments ONLY on a
// closed→open transition.
//
// Why not `key={open ? "open" : "closed"}`: the kit Sheet (alpha.120+)
// already unmounts its content once the close animation finishes, so the
// open-flag key added nothing at open — but at CLOSE-start it flipped and
// forced React to unmount + remount the whole form (Selects, date pickers)
// mid-exit-animation, a wasted full mount on the frame the sheet starts
// sliding down. An epoch that only moves on open keeps the exit cheap while
// still guaranteeing a fresh form if the sheet is reopened before the close
// animation (and therefore the unmount) has completed.

import { useRef } from "react";

export function useOpenEpoch(open: boolean): number {
  const epoch = useRef(0);
  const prev = useRef(false);
  if (open && !prev.current) epoch.current += 1;
  prev.current = open;
  return epoch.current;
}
