"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface ShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function useIsMac() {
  const [mac, setMac] = useState(true);
  useEffect(() => {
    setMac(/Mac|iPhone|iPad|iPod/.test(navigator.userAgent));
  }, []);
  return mac;
}

interface ShortcutEntry {
  description: string;
  keys: string[];
  macKeys?: string[];
}

const shortcutGroups: { heading: string; items: ShortcutEntry[] }[] = [
  {
    heading: "General",
    items: [
      {
        description: "Open command palette",
        keys: ["Ctrl", "K"],
        macKeys: ["\u2318", "K"],
      },
      { description: "Show keyboard shortcuts", keys: ["?"] },
    ],
  },
  {
    heading: "Navigation",
    items: [
      { description: "Go to Dashboard", keys: ["G", "D"] },
      { description: "Go to Calendar", keys: ["G", "C"] },
      { description: "Go to Todos", keys: ["G", "T"] },
      { description: "Go to Habits", keys: ["G", "H"] },
      { description: "Go to Journal", keys: ["G", "J"] },
      { description: "Go to Settings", keys: ["G", "S"] },
    ],
  },
  {
    heading: "Actions",
    items: [
      { description: "Quick add todo", keys: ["N"] },
      { description: "Create todo (detail)", keys: ["\u21e7", "N"] },
    ],
  },
];

export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  const isMac = useIsMac();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Navigate and take actions quickly with these shortcuts.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 space-y-4">
          {shortcutGroups.map((group) => (
            <div key={group.heading}>
              <h3 className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {group.heading}
              </h3>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const keys = isMac && item.macKeys ? item.macKeys : item.keys;
                  return (
                    <div
                      key={item.description}
                      className="flex items-center justify-between rounded-md px-2 py-1.5"
                    >
                      <span className="text-sm text-foreground">
                        {item.description}
                      </span>
                      <div className="flex items-center gap-1">
                        {keys.map((key, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1"
                          >
                            <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[11px] font-medium text-muted-foreground">
                              {key}
                            </kbd>
                            {i < keys.length - 1 && keys.length > 1 && (
                              <span className="text-[9px] text-muted-foreground/50">
                                {group.heading === "Navigation" ? "→" : "+"}
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
