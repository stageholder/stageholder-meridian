import { isDesktop } from "./index";

export async function sendNativeNotification(
  title: string,
  body?: string,
): Promise<void> {
  if (!isDesktop()) return;

  try {
    const { sendNotification, isPermissionGranted, requestPermission } =
      await import("@tauri-apps/plugin-notification");

    let permitted = await isPermissionGranted();
    if (!permitted) {
      const result = await requestPermission();
      permitted = result === "granted";
    }

    if (permitted) {
      sendNotification({ title, body });
    }
  } catch {
    // Silently fail if plugin not available
  }
}
