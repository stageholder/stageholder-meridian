import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/globals.css";
import "@stageholder/sdk/styles.css";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "@fontsource/bricolage-grotesque/400.css";
import "@fontsource/bricolage-grotesque/500.css";
import "@fontsource/bricolage-grotesque/700.css";
import { App } from "./App";
import { dispatchLoadingProgress } from "./lib/loading-progress";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

// Bump the splash to "Mounting interface" — the bundle has loaded, fonts
// are in, React is about to take over. Further progress events fire
// from App.tsx at the SDK / meta / onboarding checkpoints.
dispatchLoadingProgress(58, "Mounting interface");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Meridian no longer ships a service worker (it's a plain SPA now — no
// installability, no precached shell). But returning users who loaded an
// earlier release still have the OLD service worker installed, and it will
// keep serving its stale precached `index.html` forever — even after we
// deploy new builds — until it's explicitly unregistered. So tear down any
// previously-installed SW on every load.
//
// KEEP THIS for several releases: it must survive long enough for the SW to
// have been removed from every returning user's browser. Removing it too
// early strands anyone who hasn't reopened the app since the SW era on the
// old precached bundle. Guarded with `?.` because `navigator.serviceWorker`
// is undefined on non-secure origins / Tauri's custom scheme.
void navigator.serviceWorker?.getRegistrations().then((registrations) => {
  for (const registration of registrations) void registration.unregister();
});
