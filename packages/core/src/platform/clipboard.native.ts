/**
 * React Native clipboard write — the platform sibling of `clipboard.ts`.
 * Metro resolves this file on native (`.native.ts` suffix); web keeps
 * `clipboard.ts` (`navigator.clipboard`). Backed by `expo-clipboard`'s
 * `setStringAsync`. Same contract as the web impl: resolves `true` on success,
 * `false` on failure — call sites stay unchanged across platforms.
 *
 * Used by the shared encryption setup dialog's "copy recovery codes" action
 * (packages/features/src/encryption/passphrase-setup-dialog.tsx).
 */
import * as Clipboard from "expo-clipboard";

export async function writeToClipboard(text: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}
