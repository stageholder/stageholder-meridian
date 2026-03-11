"use client";

import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { StarVisual } from "./star-visual";
import { LIGHT_TIERS } from "@repo/core/types/light";

interface JourneyTierMapProps {
  currentTier: number;
}

export function JourneyTierMap({ currentTier }: JourneyTierMapProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const el = currentRef.current;
      const offset =
        el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2;
      container.scrollTo({ left: offset, behavior: "smooth" });
    }
  }, [currentTier]);

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pt-4 pb-3 snap-x scrollbar-none"
        style={{ scrollbarWidth: "none" }}
      >
        {LIGHT_TIERS.map((tier, i) => {
          const isCompleted = tier.tier < currentTier;
          const isCurrent = tier.tier === currentTier;
          const isFuture = tier.tier > currentTier;

          return (
            <div
              key={tier.tier}
              ref={isCurrent ? currentRef : undefined}
              className={cn(
                "relative flex shrink-0 snap-center flex-col items-center gap-2 rounded-xl border p-4 transition-all",
                "w-[100px]",
                isCurrent &&
                  "border-amber-500/50 bg-amber-500/5 shadow-sm shadow-amber-500/10",
                isCompleted && "border-border bg-muted/30",
                isFuture && "border-border/40 opacity-50",
              )}
            >
              {/* Connector line to next tier */}
              {i < LIGHT_TIERS.length - 1 && (
                <div
                  className={cn(
                    "absolute right-0 top-1/2 h-px w-3 translate-x-full",
                    tier.tier < currentTier ? "bg-amber-500/40" : "bg-border",
                  )}
                />
              )}
              <StarVisual tier={tier.tier} size="sm" animate={isCurrent} />
              <div className="text-center">
                <p
                  className={cn(
                    "text-xs font-semibold",
                    isCurrent && "text-amber-600 dark:text-amber-400",
                    isCompleted && "text-foreground",
                    isFuture && "text-muted-foreground",
                  )}
                >
                  {tier.title}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground tabular-nums">
                  {tier.lightRequired.toLocaleString()} Light
                </p>
              </div>
              {isCurrent && (
                <div className="absolute -top-1.5 right-2 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                  YOU
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
