import { isDesktop } from './index';

export async function checkForUpdates(): Promise<{ available: boolean; version?: string }> {
  if (!isDesktop()) return { available: false };

  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();
    if (update) {
      return { available: true, version: update.version };
    }
    return { available: false };
  } catch {
    return { available: false };
  }
}

export async function installUpdate(): Promise<void> {
  if (!isDesktop()) return;

  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();
    if (update) {
      await update.downloadAndInstall();
    }
  } catch {
    // Silently fail if plugin not available
  }
}
