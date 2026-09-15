/**
 * Typed GTM dataLayer events. GA4 tags are configured inside GTM — nothing is
 * sent to Google directly from here. Sign-up and login are tracked once, on
 * the Hub, so the apps don't double-count them after the OAuth callback.
 * Never put user content (habit names, todo titles, journal text) in parameters.
 */

import { APP_NAME, isAnalyticsEnabled } from "./config";

type Ecommerce = {
  currency?: string;
  value?: number;
  items?: {
    item_id: string;
    item_name: string;
    item_category: string;
    item_variant?: string;
    quantity: number;
  }[];
};

export type AnalyticsEvent =
  | { event: "page_view"; page_path: string; page_title?: string }
  | { event: "tutorial_complete" }
  | { event: "habit_create" }
  | { event: "todo_create" }
  | { event: "journal_create" }
  | ({ event: "purchase"; transaction_id: string } & Ecommerce);

type DataLayerWindow = Window & { dataLayer?: Record<string, unknown>[] };

function push(payload: Record<string, unknown>): void {
  const w = window as DataLayerWindow;
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push(payload);
}

export function track(event: AnalyticsEvent): void {
  if (!isAnalyticsEnabled()) return;
  if (event.event === "purchase") {
    // GA4 ecommerce data lives under `ecommerce`; clear the previous object
    // first because GTM merges consecutive pushes.
    const { event: name, ...ecommerce } = event;
    push({ ecommerce: null });
    push({ event: name, app_name: APP_NAME, ecommerce });
    return;
  }
  push({ ...event, app_name: APP_NAME });
}

/** Attach the Hub identity (`sub`) to subsequent GA4 hits — never the email. */
export function identify(userId: string | null): void {
  if (!isAnalyticsEnabled()) return;
  push({ user_id: userId ?? undefined });
}
