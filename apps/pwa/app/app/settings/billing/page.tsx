"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CurrentPlanHero } from "@/components/billing/current-plan-hero";
import { InvoiceLedger } from "@/components/billing/invoice-ledger";

/**
 * Meridian's billing dashboard. Composes two custom blocks built on SDK
 * hooks (`useSubscription`, `useInvoices`, `useBillingPortal`,
 * `useCanManageBilling`) — no high-level SDK component is mounted.
 *
 * The visual language is shared with /upgrade so the two surfaces feel
 * like one publication: editorial display type, mono ledger numbers,
 * orbital illustration tinted with Meridian's three product accents.
 */
export default function BillingPage() {
  return (
    <div className="billing-paper relative min-h-screen bg-background">
      <div className="relative z-10 mx-auto max-w-5xl px-4 py-10 md:py-14">
        {/* Back link */}
        <div className="mb-10">
          <Link
            href="/app/settings"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to settings
          </Link>
        </div>

        {/* Page header */}
        <header className="mb-10 flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-foreground/55">
              Billing
            </p>
            <h1
              className="mt-2 text-4xl tracking-tight md:text-5xl"
              style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
            >
              Your subscription
            </h1>
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            Manage your plan, payment method, and invoices.
          </p>
        </header>

        <div className="space-y-10">
          <CurrentPlanHero />
          <InvoiceLedger />
        </div>

        {/* Footer mark */}
        <footer className="mt-16 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-6">
          <p className="text-xs text-muted-foreground">
            Meridian — personal productivity
          </p>
          <p className="text-xs text-muted-foreground">
            Powered by Stageholder
          </p>
        </footer>
      </div>
    </div>
  );
}
