// React Native sibling of ./linking.ts — Metro picks this up via the
// `.native.ts` suffix. `Linking.openURL` always hands the URL to the system
// handler (browser / mail client), so `newTab` is meaningless here and
// accepted only for cross-platform call-site compatibility.

import { Linking } from "react-native";

export interface OpenURLOptions {
  /** Web-only concept — ignored on native (system handler always). */
  newTab?: boolean;
}

export function openURL(url: string, _opts: OpenURLOptions = {}): void {
  Linking.openURL(url).catch(() => {
    // No registered handler for the scheme (or the OS rejected it). There's
    // no meaningful recovery from a fire-and-forget opener — swallow, like
    // the web sibling's best-effort window.open.
  });
}
