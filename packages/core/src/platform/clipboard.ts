/**
 * Cross-platform clipboard write. Web: `navigator.clipboard.writeText`.
 * Future React Native impl will be a sibling module under
 * `./clipboard.native.ts` (Metro resolves the platform suffix) backed by
 * `expo-clipboard`'s `setStringAsync`. Call sites stay unchanged.
 *
 * Returns `true` on success and `false` when the runtime doesn't support
 * clipboard writes (no `navigator.clipboard`, insecure context, or the
 * permission was denied). Callers that need explicit failure UX should
 * branch on the return value; the common "copy + show toast" pattern can
 * just `await writeToClipboard(x)` and not care.
 */
export async function writeToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
