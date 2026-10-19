// apps/mobile/lib/hooks/use-mount-on-open.ts
//
// Mount a sheet/dialog HOST only once it has been asked to open.
//
// The kit's Sheet/FormSheet keep their whole shell mounted while closed — the
// Tamagui sheet frame + overlay + portal, the Reanimated driver, the gesture
// wiring, and (FormSheet) a keyboard-animation worklet that runs on every
// keyboard show. Their `mountChildren` policy only defers the BODY. Each tab
// screen hosts several of these (create/edit forms, pickers, reorder sheets),
// so a signed-in launch carried ~40 closed sheet shells for forms the user
// might never open in that session.
//
// `useMountOnOpen(open)` returns false until `open` is first true, then true
// forever: render the host only when it returns true. After the first open
// the host stays mounted, so close animations and "hold content through the
// close" behaviors are unchanged.

import { useEffect, useState } from "react";

export function useMountOnOpen(open: boolean): boolean {
  const [everOpened, setEverOpened] = useState(open);
  useEffect(() => {
    if (open) setEverOpened(true);
  }, [open]);
  return everOpened || open;
}
