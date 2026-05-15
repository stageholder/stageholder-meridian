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
