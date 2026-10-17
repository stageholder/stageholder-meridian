import type { Page } from "@playwright/test";

/**
 * Make a Chromium page look like the Tauri desktop webview.
 *
 * The desktop app is the same PWA bundle; the only difference at runtime is
 * `window.__TAURI_INTERNALS__`, which both `@repo/core` (`isDesktop()`) and
 * the SDK (`isTauri()`) key on. With it in place, the app takes every
 * desktop-only branch — Tauri-store session storage, external links through
 * the opener plugin, the desktop billing return URL and the focus-triggered
 * billing refresh — while still running in a browser Playwright can drive.
 *
 * The stub answers the Tauri IPC the app issues in `tauri dev` mode:
 *
 * - `plugin:opener|open_url` → recorded instead of opened. The journey then
 *   drives that URL in a separate, un-stubbed browser context, exactly as the
 *   user's system browser would.
 * - `plugin:store|*` → a key/value store persisted in `localStorage` (under
 *   its own prefix, so it never collides with the web session key), which is
 *   what keeps the session across the app's own reloads.
 * - `plugin:log|*`, `plugin:notification|*`, `plugin:updater|check` → no-ops.
 *
 * Anything else resolves to `null` with a console warning, so a new desktop
 * dependency shows up in the run instead of silently passing.
 *
 * Deep links and the system-browser SIGN-IN are not simulated: those are
 * packaged-build-only (`usesSystemBrowserAuth` is false under the dev
 * server), so the journey signs in in-webview like `tauri dev` does.
 */
export interface TauriStub {
  /** Every URL the app asked the OS to open, in order. */
  opened: string[];
  /**
   * Run `action` (an idempotent click), then return the next URL the app
   * hands to the opener. The action is repeated every few seconds until a
   * URL arrives: a press on a kit button can be lost while the surrounding
   * banner is still animating in.
   */
  next(action: () => Promise<void>, timeoutMs?: number): Promise<string>;
}

export async function installTauriStub(page: Page): Promise<TauriStub> {
  const opened: string[] = [];
  await page.exposeBinding("__e2eTauriOpenUrl", (_source, url: string) => {
    opened.push(url);
  });
  await page.addInitScript(stubScript);
  return {
    opened,
    async next(action, timeoutMs = 30_000) {
      const before = opened.length;
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        await action();
        const retryAt = Date.now() + 5_000;
        while (opened.length <= before && Date.now() < retryAt) {
          await new Promise((r) => setTimeout(r, 100));
        }
        if (opened.length > before) return opened[before]!;
        if (Date.now() > deadline) {
          throw new Error("the app did not hand a URL to the Tauri opener");
        }
      }
    },
  };
}

/** Fire what the desktop webview sees when the user comes back to the app. */
export async function simulateReturnToApp(page: Page): Promise<void> {
  await page.bringToFront();
  await page.evaluate(() => {
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
  });
}

function stubScript(): void {
  const STORE_PREFIX = "e2e:tauri-store:";
  const callbacks = new Map<number, (payload: unknown) => void>();
  let nextCallbackId = 1;
  const storePaths = new Map<number, string>();
  let nextRid = 1;

  const storeKey = (rid: number, key: string) =>
    `${STORE_PREFIX}${storePaths.get(rid) ?? "default"}:${key}`;
  const storeEntries = (rid: number): Array<[string, unknown]> => {
    const prefix = `${STORE_PREFIX}${storePaths.get(rid) ?? "default"}:`;
    const out: Array<[string, unknown]> = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) {
        out.push([
          k.slice(prefix.length),
          JSON.parse(localStorage.getItem(k) ?? "null"),
        ]);
      }
    }
    return out;
  };

  async function invoke(
    cmd: string,
    args: Record<string, unknown> = {},
  ): Promise<unknown> {
    const rid = Number(args.rid ?? 0);
    const key = String(args.key ?? "");
    switch (cmd) {
      case "plugin:opener|open_url":
        (
          window as unknown as { __e2eTauriOpenUrl: (u: string) => void }
        ).__e2eTauriOpenUrl(String(args.url));
        return null;
      case "plugin:store|load": {
        const id = nextRid++;
        storePaths.set(id, String(args.path));
        return id;
      }
      case "plugin:store|get_store":
        return null;
      case "plugin:store|get": {
        const raw = localStorage.getItem(storeKey(rid, key));
        return raw === null ? [null, false] : [JSON.parse(raw), true];
      }
      case "plugin:store|has":
        return localStorage.getItem(storeKey(rid, key)) !== null;
      case "plugin:store|set":
        localStorage.setItem(
          storeKey(rid, key),
          JSON.stringify(args.value ?? null),
        );
        return null;
      case "plugin:store|delete": {
        const existed = localStorage.getItem(storeKey(rid, key)) !== null;
        localStorage.removeItem(storeKey(rid, key));
        return existed;
      }
      case "plugin:store|keys":
        return storeEntries(rid).map(([k]) => k);
      case "plugin:store|values":
        return storeEntries(rid).map(([, v]) => v);
      case "plugin:store|entries":
        return storeEntries(rid);
      case "plugin:store|length":
        return storeEntries(rid).length;
      case "plugin:store|clear":
      case "plugin:store|reset":
        for (const [k] of storeEntries(rid))
          localStorage.removeItem(storeKey(rid, k));
        return null;
      case "plugin:store|save":
      case "plugin:store|reload":
        return null;
      case "plugin:notification|is_permission_granted":
        return false;
      case "plugin:notification|request_permission":
        return "denied";
      case "plugin:updater|check":
        return null; // "already up to date"
      default:
        if (cmd.startsWith("plugin:log|")) return null;
        console.warn(`[e2e tauri stub] unhandled invoke: ${cmd}`);
        return null;
    }
  }

  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    value: {
      invoke,
      transformCallback(cb: (payload: unknown) => void) {
        const id = nextCallbackId++;
        callbacks.set(id, cb);
        return id;
      },
      unregisterCallback(id: number) {
        callbacks.delete(id);
      },
      convertFileSrc: (path: string) => path,
      metadata: {
        currentWindow: { label: "main" },
        currentWebview: { label: "main" },
      },
    },
    configurable: true,
    writable: false,
  });
}
