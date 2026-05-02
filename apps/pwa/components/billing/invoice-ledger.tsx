"use client";
import { useState } from "react";
import {
  useCanManageBilling,
  useInvoices,
  useStageholder,
} from "@stageholder/sdk/react";
import { Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Invoice list rendered as a vintage logbook. Mono header row, hairline
 * separators, no zebra striping — let typography and rhythm do the work.
 *
 * Built directly on `useInvoices()` — no SDK component used. Renders the
 * admin-required note via `useCanManageBilling()` because Hub's invoice
 * endpoint 403s for non-admin members and we want the explainer here too.
 */
export function InvoiceLedger({
  changePlanHref = "/app/settings/billing/upgrade",
}: {
  changePlanHref?: string;
}) {
  const { state } = useStageholder();
  const { canManage } = useCanManageBilling();
  const { data, isLoading, isError } = useInvoices();
  const orgId =
    state.status === "authenticated" ? state.data.activeOrgId : undefined;

  return (
    <section
      className={cn(
        "relative rounded-[32px] border border-border/70 bg-card/85 backdrop-blur-sm",
        "p-8 md:p-10",
        "billing-reveal billing-stagger-3",
      )}
    >
      {/* Header */}
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border/70 pb-5">
        <div className="space-y-1">
          <h2
            className="text-2xl tracking-tight"
            style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
          >
            Invoices
          </h2>
          <p className="text-sm text-muted-foreground">
            All past charges and downloadable receipts.
          </p>
        </div>
        {(data?.length ?? 0) > 0 && (
          <p className="text-xs text-muted-foreground">
            {data?.length} {data?.length === 1 ? "invoice" : "invoices"}
          </p>
        )}
      </header>

      {/* Body branches */}
      {!canManage && state.status === "authenticated" ? (
        <NoticePanel
          headline="Only admins can view invoices"
          body="Ask an owner or admin in your organization for a copy of any invoice."
        />
      ) : isLoading ? (
        <LedgerSkeleton />
      ) : isError ? (
        <NoticePanel
          headline="Couldn't load invoices"
          body="Something went wrong on our side. Refresh the page or try again in a minute."
        />
      ) : !data || data.length === 0 ? (
        <EmptyLedger changePlanHref={changePlanHref} />
      ) : (
        <ol className="space-y-0">
          <li className="grid grid-cols-[1fr_1fr_1fr_auto] gap-6 border-b border-border/60 pb-3 text-xs font-medium text-muted-foreground">
            <span>Date</span>
            <span>Reason</span>
            <span>Amount</span>
            <span className="justify-self-end">Receipt</span>
          </li>
          {data.map((inv) => (
            <li
              key={inv.id}
              className={cn(
                "grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-6",
                "border-b border-border/40 py-4",
                "transition-colors hover:bg-foreground/3",
              )}
            >
              <span className="font-mono text-[12px] tabular-nums text-foreground">
                {new Date(inv.createdAt).toLocaleDateString(undefined, {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              <span className="text-[13px] capitalize text-foreground/85">
                {humanReason(inv.billingReason)}
              </span>
              <span className="font-mono text-[14px] font-medium tabular-nums text-foreground">
                {inv.totalFormatted}
              </span>
              <DownloadButton orgId={orgId} orderId={inv.id} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/**
 * "Download" pill on a single invoice row. Hub's `/api/billing/invoices/:orgId/:orderId/url`
 * returns `{url}` JSON (not a redirect), so an anchor href would navigate to
 * the JSON page. Fetch the JSON on click, then open the resolved Polar
 * hosted-invoice URL in a new tab.
 */
function DownloadButton({
  orgId,
  orderId,
}: {
  orgId: string | undefined;
  orderId: string;
}) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={!orgId || pending}
      onClick={async () => {
        if (!orgId) return;
        setPending(true);
        try {
          const res = await fetch(
            `/api/billing/invoices/${orgId}/${orderId}/url`,
            { credentials: "include", headers: { accept: "application/json" } },
          );
          if (!res.ok) throw new Error(`invoice url failed: ${res.status}`);
          const { url } = (await res.json()) as { url?: string };
          if (url) window.open(url, "_blank", "noopener,noreferrer");
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("[meridian] invoice download failed:", err);
        } finally {
          setPending(false);
        }
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border/80 px-3 py-1.5 text-xs font-medium text-foreground/80",
        "transition-colors hover:border-foreground/80 hover:bg-foreground hover:text-background",
        "disabled:pointer-events-none disabled:opacity-50",
      )}
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
      ) : (
        <Download className="size-3.5" strokeWidth={2} />
      )}
      Download
    </button>
  );
}

function NoticePanel({ headline, body }: { headline: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-6">
      <p
        className="text-base tracking-tight"
        style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
      >
        {headline}
      </p>
      <p className="mt-2 max-w-md text-[13px] leading-relaxed text-muted-foreground">
        {body}
      </p>
    </div>
  );
}

function EmptyLedger({ changePlanHref }: { changePlanHref: string }) {
  return (
    <div className="grid items-center gap-6 rounded-2xl border border-dashed border-border/80 bg-background/40 p-8 sm:grid-cols-[1fr_auto]">
      <div>
        <p
          className="text-lg tracking-tight"
          style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
        >
          No invoices yet
        </p>
        <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-muted-foreground">
          You&rsquo;re on the Free plan. Once you upgrade, every invoice will
          appear here as a downloadable PDF.
        </p>
      </div>
      <a
        href={changePlanHref}
        className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90"
      >
        See plans
      </a>
    </div>
  );
}

function LedgerSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-6 border-b border-border/40 py-4"
        >
          <div className="h-3 w-24 animate-pulse rounded-full bg-border/70" />
          <div className="h-3 w-32 animate-pulse rounded-full bg-border/70" />
          <div className="h-3 w-16 animate-pulse rounded-full bg-border/70" />
          <div className="h-7 w-24 animate-pulse rounded-full bg-border/70" />
        </div>
      ))}
    </div>
  );
}

function humanReason(reason: string): string {
  switch (reason) {
    case "subscription_create":
      return "New subscription";
    case "subscription_cycle":
      return "Renewal";
    case "subscription_update":
      return "Plan change";
    case "purchase":
      return "Purchase";
    default:
      return reason.replace(/_/g, " ");
  }
}
