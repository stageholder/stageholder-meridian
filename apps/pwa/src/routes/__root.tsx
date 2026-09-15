import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import type { RouterContext } from "../router";
import { PageViewTracker } from "@/analytics/trackers";

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <>
      <PageViewTracker />
      <Outlet />
    </>
  ),
});
