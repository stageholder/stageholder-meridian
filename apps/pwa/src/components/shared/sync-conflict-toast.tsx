import { useEffect } from "react";
import { useToast } from "@stageholder/ui";
import { setConflictHandler } from "@/lib/offline";
import type { SyncConflict } from "@repo/offline/sync/sync-manager";

export function SyncConflictListener() {
  const toast = useToast();
  useEffect(() => {
    setConflictHandler((conflicts: SyncConflict[]) => {
      if (conflicts.length === 0) return;

      const count = conflicts.length;
      toast.show({
        title:
          count === 1
            ? "One of your offline changes was overwritten by newer server data."
            : `${count} of your offline changes were overwritten by newer server data.`,
        intent: "warning",
        duration: 6000,
      });
    });

    return () => setConflictHandler(() => {});
  }, [toast]);

  return null;
}
