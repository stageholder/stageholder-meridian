import { useEffect, useRef } from "react";
import { useUser } from "@stageholder/sdk/spa";
import { useRouterState } from "@tanstack/react-router";

import { identify, track } from "./events";

/**
 * page_view on first render and every route change. The GTM Google tag must
 * set `send_page_view: false`, otherwise the first hit is double-counted.
 */
export function PageViewTracker() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (pathname === lastPath.current) return;
    lastPath.current = pathname;
    track({ event: "page_view", page_path: pathname, page_title: document.title });
  }, [pathname]);

  return null;
}

/** Keeps GA4's user_id in sync with the signed-in Hub identity. */
export function AnalyticsIdentity() {
  const { user } = useUser();
  const userId = user?.sub ?? null;

  useEffect(() => {
    identify(userId);
  }, [userId]);

  return null;
}
