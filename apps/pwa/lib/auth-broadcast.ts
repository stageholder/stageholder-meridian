"use client";

/**
 * Cross-tab auth broadcast over BroadcastChannel. When the user signs out
 * in any Meridian tab, every other tab of the same origin hard-navigates
 * to /auth/login so stale authenticated UI disappears immediately instead
 * of waiting for the next API call to surface a 401.
 *
 * BroadcastChannel is same-origin; Tauri desktop and the PWA both qualify.
 * Safari 15.3+ and every modern browser support it. Falls back silently
 * when unsupported — the receiving tab will still re-auth on next API call.
 */

const CHANNEL_NAME = "meridian-auth";

type LogoutMessage = { type: "logout" };

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (typeof BroadcastChannel === "undefined") return null;
  return new BroadcastChannel(CHANNEL_NAME);
}

export function announceLogout(): void {
  const channel = getChannel();
  if (!channel) return;
  try {
    channel.postMessage({ type: "logout" } satisfies LogoutMessage);
  } finally {
    channel.close();
  }
}

/**
 * Subscribe to logout broadcasts from other tabs. Returns an unsubscribe
 * function; call it from the effect's cleanup. On receipt we reload via
 * full navigation so the new proxy-guarded load fires and the user lands
 * on /auth/login cleanly.
 */
export function subscribeLogout(onLogout: () => void): () => void {
  const channel = getChannel();
  if (!channel) return () => {};
  const handler = (event: MessageEvent<LogoutMessage>) => {
    if (event.data?.type === "logout") onLogout();
  };
  channel.addEventListener("message", handler);
  return () => {
    channel.removeEventListener("message", handler);
    channel.close();
  };
}
