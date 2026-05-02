"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useCanManageBilling } from "@stageholder/sdk/react";
import type { PaywallReason } from "@stageholder/sdk/core";
import { ArrowUpRight } from "lucide-react";
import { LimitOrbit } from "./limit-orbit";
import { cn } from "@/lib/utils";

const PRICING_HREF = "/app/settings/billing/upgrade";

export interface MeridianPaywallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Bind to `usePaywall().reason` from the SDK. `null` → renders nothing. */
  reason: PaywallReason | null;
}

/**
 * Meridian's bespoke paywall dialog. Built on Radix Dialog directly — does
 * NOT call into the SDK's `<PaywallModal>`. The state machine (open
 * /close/reason) still flows from SDK's `usePaywall()`; only the
 * presentation is owned by Meridian.
 *
 * Reads consistently with the billing dashboard and the upgrade page:
 * editorial gutter mark, Bricolage display headline with italic emphasis,
 * mono ledger, paper-grain backdrop, orbital diagram. The diagram is a
 * diagnostic variant — it lights up the gated pillar (todos / habits /
 * journal) so the user instantly sees which boundary they hit.
 */
export function MeridianPaywallModal({
  open,
  onOpenChange,
  reason,
}: MeridianPaywallModalProps) {
  const { canManage } = useCanManageBilling();
  if (!reason) return null;

  const close = () => onOpenChange(false);
  const featureLabel = reason.featureLabel ?? reason.feature;
  const planName =
    reason.suggestedPlanName ?? reason.suggestedPlan ?? "Unlimited";
  const pillar = pillarForFeature(reason.feature);
  const upgradeHref = appendQuery(PRICING_HREF, {
    feature: reason.feature,
    ...(reason.suggestedPlan && { plan: reason.suggestedPlan }),
  });

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-foreground/35 backdrop-blur-md",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        />
        <Dialog.Content
          className={cn(
            "fixed z-50 overflow-hidden bg-card text-card-foreground shadow-2xl",
            // Mobile bottom-sheet flush with bottom; desktop centered card.
            "inset-x-0 bottom-0 max-h-[94vh] w-full overflow-y-auto rounded-t-[32px] border border-b-0 border-border/70",
            "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-none sm:w-full sm:max-w-2xl",
            "sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[32px] sm:border-b",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "max-sm:data-[state=closed]:slide-out-to-bottom max-sm:data-[state=open]:slide-in-from-bottom",
            "sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95",
          )}
        >
          {/* Mobile drag handle */}
          <div
            aria-hidden
            className="mx-auto mt-2 h-1 w-10 rounded-full bg-foreground/15 sm:hidden"
          />

          {/* Paper-grain backdrop scoped to the dialog. Same atmosphere
              as the billing pages, contained inside the modal so it
              doesn't leak into anything underneath. */}
          <div
            className="relative billing-paper"
            style={{ backgroundColor: "transparent" }}
          >
            <div className="relative z-10 px-7 pb-8 pt-7 sm:px-10 sm:py-10">
              {/* Top strip */}
              <div className="mb-7 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-5">
                <span className="text-xs font-medium text-muted-foreground">
                  Plan limit reached
                </span>
                <PillarBadge pillar={pillar} />
              </div>

              {/* Two-column body — text + ledger on the left, orbital
                  diagram on the right. The CTAs DON'T live in this grid;
                  they sit below it spanning the full modal width so the
                  primary button is the most obvious target on the page. */}
              <div className="grid gap-8 sm:grid-cols-[1.3fr_1fr] sm:gap-10">
                {/* Text + ledger column */}
                <section className="space-y-7">
                  <div className="space-y-4">
                    <p className="text-sm font-semibold text-foreground/55">
                      {reason.currentLimit !== undefined
                        ? "You hit a usage limit"
                        : "Upgrade required"}
                    </p>
                    <Dialog.Title asChild>
                      <h2
                        className="text-[clamp(1.875rem,4.5vw,2.5rem)] leading-[1.02] tracking-[-0.01em]"
                        style={{
                          fontFamily: "var(--font-display)",
                          fontWeight: 600,
                        }}
                      >
                        You&rsquo;ve hit your{" "}
                        <span className="italic" style={{ fontWeight: 500 }}>
                          {featureLabel}
                        </span>{" "}
                        limit.
                      </h2>
                    </Dialog.Title>
                    <Dialog.Description className="max-w-md text-[14px] leading-relaxed text-muted-foreground">
                      {reason.customMessage ??
                        buildBody(featureLabel, planName, reason.currentLimit)}
                    </Dialog.Description>
                  </div>

                  {/* Mobile-only inline diagram — sits between body and
                      ledger on small screens so the user gets visual
                      context without the desktop side-by-side. */}
                  <div className="sm:hidden">
                    <div className="relative mx-auto aspect-square w-full max-w-[180px]">
                      <div className="absolute inset-0 rounded-[20px] bg-background/60 ring-1 ring-border/70" />
                      <div className="absolute inset-0 p-3">
                        <LimitOrbit highlight={pillar} />
                      </div>
                    </div>
                  </div>

                  {/* Plain key/value ledger. Labels are short, values are
                      instantly scannable. */}
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border/60 pt-5">
                    <LedgerCell label="Current plan" value="Free" />
                    <LedgerCell
                      label="Used"
                      value={
                        reason.currentLimit !== undefined
                          ? `${reason.currentLimit} of ${reason.currentLimit}`
                          : "—"
                      }
                      mono
                    />
                    <LedgerCell label="Feature" value={prettyPillar(pillar)} />
                    <LedgerCell label="Recommended" value={planName} />
                  </dl>
                </section>

                {/* Diagram column (desktop only) */}
                <aside className="hidden sm:block">
                  <div className="relative mx-auto aspect-square w-full max-w-[280px]">
                    <div className="absolute inset-0 rounded-[24px] bg-background/60 ring-1 ring-border/70" />
                    <div className="absolute inset-0 p-5">
                      <LimitOrbit highlight={pillar} />
                    </div>
                    {(["tl", "tr", "bl", "br"] as const).map((c) => (
                      <CornerTick key={c} corner={c} />
                    ))}
                  </div>
                  <p className="mt-4 text-center text-[12px] text-muted-foreground">
                    Your{" "}
                    <span className="font-medium text-foreground">
                      {prettyPillar(pillar).toLowerCase()}
                    </span>{" "}
                    ring is full
                  </p>
                </aside>
              </div>

              {/* Non-admin notice — full modal width below the body. */}
              {!canManage && (
                <div
                  role="note"
                  className="mt-8 rounded-2xl border border-dashed border-border/80 bg-muted/30 p-4 text-[13px] leading-relaxed text-muted-foreground"
                >
                  Only owners and admins can change the plan. Ask an admin on
                  your organization to upgrade.
                </div>
              )}

              {/* Full-width CTAs — pulled out of the grid so the primary
                  button spans the entire modal. Industry-standard
                  upgrade-prompt layout (Linear, Notion, Stripe): one
                  unmistakable primary action, one quiet text-link exit. */}
              <div className="mt-8 space-y-3">
                {canManage && (
                  <a
                    href={upgradeHref}
                    onClick={close}
                    className={cn(
                      "group/cta flex h-12 w-full items-center justify-between gap-3 rounded-full bg-foreground pl-6 pr-1.5 text-background",
                      "text-[14px] font-medium",
                      "transition-opacity hover:opacity-90",
                    )}
                  >
                    <span>Upgrade your plan</span>
                    <span className="inline-flex size-9 items-center justify-center rounded-full bg-background/15 transition-transform group-hover/cta:translate-x-0.5">
                      <ArrowUpRight className="size-3.5" strokeWidth={2} />
                    </span>
                  </a>
                )}
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className={cn(
                      "block w-full rounded-full px-5 py-2 text-center",
                      "text-[13px] text-muted-foreground",
                      "transition-colors hover:text-foreground",
                    )}
                  >
                    Maybe later
                  </button>
                </Dialog.Close>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function PillarBadge({
  pillar,
}: {
  pillar: "todos" | "habits" | "journal" | null;
}) {
  if (!pillar) return null;

  const tone =
    pillar === "todos"
      ? "var(--color-ring-todo, var(--ring-todo))"
      : pillar === "habits"
        ? "var(--color-ring-habit, var(--ring-habit))"
        : "var(--color-ring-journal, var(--ring-journal))";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/70 px-3 py-1",
        "text-xs font-medium text-foreground/80",
      )}
    >
      <span
        aria-hidden
        className="size-1.5 rounded-full"
        style={{ backgroundColor: tone }}
      />
      {prettyPillar(pillar)}
    </span>
  );
}

function LedgerCell({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-[15px] font-semibold leading-tight text-foreground",
          mono && "tabular-nums",
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
    />
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Map a Meridian feature slug to one of the three product pillars.
 * Source slugs are defined in `apps/api/src/common/helpers/entitlement.ts`
 * (`MeridianFeatureSlug`). New gated features should slot into the
 * matching pillar so the orbital diagram stays diagnostic.
 *
 * Returns `null` for unknown slugs — the modal still renders, just with
 * an all-ghost orbit (no highlighted ring).
 */
function pillarForFeature(
  feature: string,
): "todos" | "habits" | "journal" | null {
  if (feature === "max_habits") return "habits";
  if (feature === "max_todo_lists" || feature === "max_active_todos")
    return "todos";
  if (feature.startsWith("max_journal")) return "journal";
  return null;
}

function prettyPillar(pillar: "todos" | "habits" | "journal" | null): string {
  switch (pillar) {
    case "todos":
      return "Todos";
    case "habits":
      return "Habits";
    case "journal":
      return "Journal";
    default:
      return "Other";
  }
}

function buildBody(
  featureLabel: string,
  planName: string,
  currentLimit: number | undefined,
): string {
  if (typeof currentLimit === "number") {
    return `Your Free plan includes ${currentLimit} ${featureLabel}. Upgrade to ${planName} for unlimited ${featureLabel} and no usage caps.`;
  }
  return `This feature is available on the ${planName} plan. Upgrade to unlock it.`;
}

function appendQuery(
  base: string,
  params: Record<string, string | undefined>,
): string {
  const filtered = Object.entries(params).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  );
  if (filtered.length === 0) return base;
  const qs = filtered
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}${qs}`;
}
