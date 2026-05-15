import { Store } from "@tauri-apps/plugin-store";
import type { StorageAdapter } from "@stageholder/sdk/spa";

/**
 * Persists SDK SPA session keys (PKCE pending records, access/refresh
 * tokens, ID token) in a Tauri plugin-store file on disk. Survives full
 * app restart — unlike the webview's localStorage which `clear_all_browsing_data()`
 * in `src-tauri/src/lib.rs` wipes at every cold boot.
 *
 * File location is platform-default for tauri-plugin-store ($APPDATA on
 * Windows, ~/Library/Application Support/... on macOS).
 *
 * Replaces the hand-rolled refresh-token persistence from the deleted
 * `lib/oidc-tauri.ts`.
 */
const STORE_FILE = "auth.dat";
const KEY_PREFIX = "sdk:";

let storePromise: Promise<Store> | null = null;
function loadStore(): Promise<Store> {
  if (!storePromise) storePromise = Store.load(STORE_FILE);
  return storePromise;
}

export class TauriStorageAdapter implements StorageAdapter {
  // Per the SDK contract, `clearAll()` is meant to remove only SDK-owned
  // entries — track them locally so we don't blow away unrelated state
  // someone else might have written to the same store file.
  private readonly ownedKeys = new Set<string>();

  async getItem(key: string): Promise<string | null> {
    const store = await loadStore();
    const value = await store.get<string>(KEY_PREFIX + key);
    return value ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    const store = await loadStore();
    await store.set(KEY_PREFIX + key, value);
    await store.save();
    this.ownedKeys.add(key);
  }

  async deleteItem(key: string): Promise<void> {
    const store = await loadStore();
    await store.delete(KEY_PREFIX + key);
    await store.save();
    this.ownedKeys.delete(key);
  }

  async clearAll(): Promise<void> {
    const store = await loadStore();
    for (const key of Array.from(this.ownedKeys)) {
      await store.delete(KEY_PREFIX + key);
    }
    await store.save();
    this.ownedKeys.clear();
  }
}
