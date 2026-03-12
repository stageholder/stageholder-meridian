"use client";

import { useState, useMemo } from "react";
import { ChevronDownIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface TimezoneSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}

export function TimezoneSelect({
  value,
  onValueChange,
  className,
}: TimezoneSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const timezones = useMemo(() => Intl.supportedValuesOf("timeZone"), []);

  const filtered = useMemo(() => {
    if (!search) return timezones;
    const q = search.toLowerCase();
    return timezones.filter((tz) => tz.toLowerCase().includes(q));
  }, [timezones, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <span className="truncate">{value || "Select timezone..."}</span>
          <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <div className="border-b border-border px-3 py-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search timezone..."
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            autoFocus
          />
        </div>
        <div className="max-h-60 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">
              No timezone found.
            </p>
          ) : (
            filtered.map((tz) => (
              <button
                key={tz}
                type="button"
                onClick={() => {
                  onValueChange(tz);
                  setOpen(false);
                  setSearch("");
                }}
                className={cn(
                  "flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground",
                  value === tz &&
                    "bg-accent text-accent-foreground font-medium",
                )}
              >
                {tz}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
