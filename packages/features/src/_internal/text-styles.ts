// src/_internal/text-styles.ts
//
// Cross-platform text style snippets for the `style={{}}` escape hatch.
//
// Why this exists: `fontVariantNumeric: "tabular-nums"` is the WEB CSS key
// (react-native-web understands it), but it is NOT a valid React Native style
// key. On native, passing an unknown style key triggers a dev-mode warning and
// is silently dropped, so the digits never tabularize. RN's equivalent is the
// `fontVariant: ["tabular-nums"]` array form.
//
// `tabularNums` resolves to whichever shape the active runtime understands —
// the web CSS key under react-native-web, the RN array form on native — so
// every "make the digits monospaced" site can spread a single import and get
// identical visual output on both platforms.
//
// Usage:
//   <Text style={tabularNums}>{value}</Text>
//   <Text style={{ ...tabularNums, color: accent }}>{value}</Text>

import { isWeb } from "tamagui";

/**
 * Tabular (monospaced) figures for the `style` prop. Web uses the CSS
 * `fontVariantNumeric` longhand; native uses RN's `fontVariant` array form.
 * Typed loosely (the two runtimes disagree on the key) so it spreads cleanly
 * into either a web or RN style object.
 */
export const tabularNums = (
  isWeb
    ? { fontVariantNumeric: "tabular-nums" }
    : { fontVariant: ["tabular-nums"] }
) as Record<string, unknown>;
