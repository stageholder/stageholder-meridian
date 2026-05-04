"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useSubscription } from "@stageholder/sdk/react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Compact trial countdown for the app header. Replaces the page-width
 * amber banner that used to sit above main content.
 *
 * Renders nothing unless the active subscription is in `trialing` status.
 * Color escalates as the trial runs down — amber while comfortable,
 * rose with a soft pulse in the final stretch — so the pill earns
 * attention without shouting on day 14.
 */
export function TrialPill({
  upgradeHref = "/app/settings/billing/upgrade",
  urgentBelowDays = 3,
}: {
  upgradeHref?: string;
  urgentBelowDays?: number;
}) {
  const sub = useSubscription();
  if (!sub || sub.status !== "trialing") return null;

  const daysRemaining = sub.trialEndsAt ? daysUntil(sub.trialEndsAt) : null;
  const urgent = daysRemaining !== null && daysRemaining <= urgentBelowDays;
  const endsAt = sub.trialEndsAt ? new Date(sub.trialEndsAt) : null;
  const endsAtLabel = endsAt
    ? endsAt.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const longLabel =
    daysRemaining !== null
      ? `${daysRemaining} ${daysRemaining === 1 ? "day" : "days"} left`
      : "Trial";
  const shortLabel = daysRemaining !== null ? `${daysRemaining}d` : "Trial";

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={upgradeHref}
            aria-label={`${longLabel} in trial — manage subscription`}
            className={cn(
              "group relative inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5",
              "text-[11px] font-medium tracking-tight",
              "transition-colors duration-200",
              urgent
                ? "border-rose-500/35 bg-rose-500/10 text-rose-700 hover:border-rose-500/60 hover:bg-rose-500/15 dark:text-rose-300"
                : "border-amber-500/35 bg-amber-500/10 text-amber-800 hover:border-amber-500/60 hover:bg-amber-500/15 dark:text-amber-200",
            )}
          >
            <Sparkles
              className={cn(
                "size-3 shrink-0 transition-transform duration-300",
                urgent && "animate-pulse",
                "group-hover:rotate-12",
              )}
              strokeWidth={2}
              aria-hidden
            />
            <span className="font-mono tabular-nums leading-none">
              <span className="hidden sm:inline">{longLabel}</span>
              <span className="sm:hidden">{shortLabel}</span>
            </span>
            <span
              aria-hidden
              className="mx-0.5 hidden h-3 w-px bg-current opacity-30 sm:inline-block"
            />
            {/* "Manage" rather than "Upgrade": the trialed plan can already
                be the top tier, so there's nothing to upgrade *to*. The
                destination /upgrade page handles plan switches AND trial
                management uniformly, so this verb covers both cases without
                misleading top-tier trialers. */}
            <span
              aria-hidden
              className={cn(
                "hidden font-semibold uppercase tracking-[0.08em] sm:inline",
                "transition-transform duration-200 group-hover:translate-x-0.5",
              )}
            >
              Manage
            </span>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" className="max-w-xs">
          {endsAtLabel ? (
            <div className="flex flex-col gap-0.5">
              <span>
                Free trial of{" "}
                <span className="font-semibold">{sub.planName}</span>
              </span>
              <span className="opacity-70">
                Ends {endsAtLabel} · Click to manage
              </span>
            </div>
          ) : (
            <span>Trial in progress — click to manage</span>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Whole days from now until `iso`. Floored, never negative — a trial that's
 * 6 hours from ending shows "1 day left" rather than "0 days left", which
 * reads better in the pill. Mirrors the SDK's TrialBanner logic.
 */
function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return 0;
  if (ms <= 0) return 0;
  return Math.max(1, Math.ceil(ms / 86_400_000));
}
