"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { setConflictHandler } from "@/lib/offline";
import type { SyncConflict } from "@repo/offline/sync/sync-manager";

export function SyncConflictListener() {
  useEffect(() => {
    setConflictHandler((conflicts: SyncConflict[]) => {
      if (conflicts.length === 0) return;

      const count = conflicts.length;
      toast.warning(
        count === 1
          ? "One of your offline changes was overwritten by newer server data."
          : `${count} of your offline changes were overwritten by newer server data.`,
        { duration: 6000 },
      );
    });

    return () => setConflictHandler(() => {});
  }, []);

  return null;
}
