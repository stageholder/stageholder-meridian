import { detectPlatform } from "@repo/core/platform";

export function registerServiceWorker() {
  if (detectPlatform() === "desktop") return;
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW registration failed — non-critical
      });
    });
  }
}
