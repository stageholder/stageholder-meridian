"use client";
import {
  useBillingPortal,
  useCanManageBilling,
  useStageholder,
  useSubscription,
} from "@stageholder/sdk/react";
import Link from "next/link";
import { ArrowUpRight, ExternalLink } from "lucide-react";
import { OrbitIllustration } from "./orbit-illustration";
import { cn } from "@/lib/utils";

/**
 * Editorial hero for the billing dashboard. Reads like the cover page of
 * a quarterly report: large display name of the current plan, mono
 * metadata (status, renewal, member count), and an abstract orbital
 * illustration on the right that mirrors the upgrade page so the two
 * surfaces feel like one publication.
 *
 * Built entirely from SDK hooks (`useSubscription`, `useCanManageBilling`,
 * `useBillingPortal`, `useStageholder`) — no high-level SDK component
 * involved. This is the pattern Meridian uses to fully customize the
 * billing UX while still relying on Hub for the underlying truth.
 */
export function CurrentPlanHero({
  changePlanHref = "/app/settings/billing/upgrade",
}: {
  changePlanHref?: string;
}) {
  const sub = useSubscription();
  const { state } = useStageholder();
  const { canManage } = useCanManageBilling();
  const { open: openPortal, isPending: portalPending } = useBillingPortal();

  if (state.status !== "authenticated") {
    return <HeroSkeleton />;
  }

  const isFree = !sub;
  const planName = sub?.planName ?? "Free";
  const status = sub?.status ?? "active";
  const seats =
    sub?.pricingModel === "seat_based"
      ? { used: sub.seats ?? 0, total: sub.memberLimit ?? 0 }
      : null;

  const tier: "rest" | "practice" | "conduct" = isFree
    ? "rest"
    : status === "trialing"
      ? "practice"
      : "conduct";

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[32px] border border-border/70",
        "bg-gradient-to-br from-card via-card to-card/70",
        "p-8 md:p-10",
        "billing-reveal billing-stagger-1",
      )}
    >
      {/* Top-row status strip */}
      <div className="mb-10 flex items-center gap-3">
        <StatusPill status={status} />
      </div>

      <div className="grid gap-10 md:grid-cols-[1.4fr_1fr] md:items-center">
        {/* Left: plan name + meta + actions */}
        <div className="space-y-8">
          <div className="space-y-3">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">
              Current plan
            </p>
            <h1
              className="text-[clamp(2.75rem,7vw,5rem)] leading-[0.92] tracking-[-0.02em]"
              style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
            >
              {planName}
            </h1>
          </div>

          <dl className="grid grid-cols-2 gap-x-8 gap-y-5 border-t border-border/60 pt-6 sm:grid-cols-3">
            <MetaCell
              label="Billing"
              value={
                isFree
                  ? "No charges"
                  : sub?.pricingModel === "seat_based"
                    ? "Per seat"
                    : "Flat rate"
              }
            />
            <MetaCell
              label="Seats"
              value={seats ? `${seats.used} of ${seats.total}` : "1 of 1"}
            />
            <MetaCell
              label="Account"
              value={state.data.email ?? state.data.name ?? "you"}
              ellipsis
            />
          </dl>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href={changePlanHref}
              className={cn(
                "group/btn inline-flex h-11 items-center gap-2 rounded-full bg-foreground pl-5 pr-1.5 text-sm font-medium text-background",
                "transition-opacity hover:opacity-90",
              )}
            >
              {isFree ? "Upgrade your plan" : "Change plan"}
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-background/15 transition-transform group-hover/btn:translate-x-0.5">
                <ArrowUpRight className="size-3.5" strokeWidth={2} />
              </span>
            </Link>

            {canManage && !isFree && (
              <button
                type="button"
                disabled={portalPending}
                onClick={() => {
                  openPortal({
                    returnUrl: `${window.location.origin}/app/settings/billing`,
                  }).catch((err) =>
                    // eslint-disable-next-line no-console
                    console.error("[meridian] portal failed:", err),
                  );
                }}
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-full border border-foreground/80 bg-background px-5 text-sm font-medium text-foreground",
                  "transition-colors hover:bg-foreground hover:text-background",
                  "disabled:pointer-events-none disabled:opacity-50",
                )}
              >
                {portalPending ? "Opening…" : "Manage payment"}
                <ExternalLink className="size-3.5" strokeWidth={2} />
              </button>
            )}
          </div>

          {!canManage && !isFree && (
            <p className="border-l-2 border-foreground/15 pl-4 text-xs text-muted-foreground">
              Only owners and admins can change the plan or update payment
              details. Ask an admin in your organization for changes.
            </p>
          )}
        </div>

        {/* Right: orbital illustration framed like a printer's plate */}
        <div className="relative hidden md:block">
          <div className="relative mx-auto aspect-square w-full max-w-[320px]">
            <div className="absolute inset-0 rounded-[28px] bg-background/60 ring-1 ring-border/70" />
            <div className="absolute inset-0 p-6">
              <OrbitIllustration tier={tier} />
            </div>
            {/* corner ticks */}
            {(["tl", "tr", "bl", "br"] as const).map((c) => (
              <CornerTick key={c} corner={c} />
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Your active features
          </p>
        </div>
      </div>
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "active"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : status === "trialing"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
        : status === "past_due"
          ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
          : "bg-muted text-muted-foreground";
  const label =
    status === "active"
      ? "Active"
      : status === "trialing"
        ? "Free trial"
        : status === "past_due"
          ? "Payment due"
          : status;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
        tone,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function MetaCell({
  label,
  value,
  ellipsis,
}: {
  label: string;
  value: string;
  ellipsis?: boolean;
}) {
  return (
    <div className="space-y-1">
      <dt className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "text-sm font-medium tabular-nums",
          ellipsis && "truncate",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function CornerTick({ corner }: { corner: "tl" | "tr" | "bl" | "br" }) {
  const pos: Record<typeof corner, string> = {
    tl: "top-2 left-2",
    tr: "top-2 right-2",
    bl: "bottom-2 left-2",
    br: "bottom-2 right-2",
  };
  return (
    <span
      aria-hidden
      className={cn(
        "absolute size-3",
        pos[corner],
        "before:absolute before:inset-0 before:border-foreground/30",
        corner === "tl" && "before:border-l before:border-t",
        corner === "tr" && "before:border-r before:border-t",
        corner === "bl" && "before:border-l before:border-b",
        corner === "br" && "before:border-r before:border-b",
      )}
    >
      <span className="absolute inset-0" />
    </span>
  );
}

function HeroSkeleton() {
  return (
    <section className="rounded-[32px] border border-border/70 bg-card/40 p-10">
      <div className="h-2 w-32 animate-pulse rounded-full bg-border/80" />
      <div className="mt-6 h-16 w-2/3 animate-pulse rounded-2xl bg-border/60" />
      <div className="mt-10 grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-xl bg-border/40" />
        ))}
      </div>
    </section>
  );
}
