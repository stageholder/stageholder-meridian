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

// Register the PWA service worker only when running over http(s) — Tauri's
// tauri:// (macOS/Linux) and http://tauri.localhost (Windows) origins make
// WebKit reject ServiceWorker.register() with "must be called with a script
// URL whose protocol is either HTTP or HTTPS". The PWA plugin's auto-inject
// is off (see vite.config.ts) so this is the single registration site.
if (/^https?:$/.test(window.location.protocol)) {
  void import("virtual:pwa-register").then(({ registerSW }) => {
    registerSW({ immediate: true });
  });
}
