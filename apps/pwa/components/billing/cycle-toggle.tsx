"use client";
import { cn } from "@/lib/utils";

/**
 * Segmented monthly / yearly toggle. Reads like a printer's mark — thin
 * outlined pill, mono labels, a quietly animated indicator that slides
 * between segments. Used on the upgrade page above the plan grid.
 */
export function CycleToggle({
  value,
  onChange,
  yearlyDiscountLabel,
}: {
  value: "monthly" | "yearly";
  onChange: (next: "monthly" | "yearly") => void;
  /**
   * Optional micro-copy attached to the yearly segment, e.g. "save 16%".
   * Rendered in monospaced uppercase as a vintage callout.
   */
  yearlyDiscountLabel?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Billing cycle"
      className={cn(
        "relative inline-flex items-center rounded-full border border-border/80 bg-background/60",
        "p-1 text-sm font-medium backdrop-blur-sm",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-1 bottom-1 rounded-full bg-foreground transition-transform duration-500",
          "shadow-[0_2px_10px_-4px_color-mix(in_oklch,var(--foreground)_45%,transparent)]",
          "ease-[cubic-bezier(0.22,1,0.36,1)]",
        )}
        style={{
          width: "calc(50% - 4px)",
          left: "4px",
          transform: value === "monthly" ? "translateX(0)" : "translateX(100%)",
        }}
      />
      <Segment
        selected={value === "monthly"}
        onClick={() => onChange("monthly")}
      >
        Monthly
      </Segment>
      <Segment selected={value === "yearly"} onClick={() => onChange("yearly")}>
        <span className="inline-flex items-center gap-2">
          Yearly
          {yearlyDiscountLabel && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                value === "yearly"
                  ? "bg-background/15 text-background"
                  : "bg-foreground/8 text-foreground/65",
              )}
            >
              {yearlyDiscountLabel}
            </span>
          )}
        </span>
      </Segment>
    </div>
  );
}

function Segment({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "relative z-10 inline-flex h-9 min-w-[120px] items-center justify-center rounded-full px-5 transition-colors duration-300",
        selected
          ? "text-background"
          : "text-foreground/65 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
