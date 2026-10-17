// Tamagui type augmentation for THIS PACKAGE'S standalone `tsc` check only.
//
// Shorthand props (`items`, `rounded`, `mt`, …) and token types exist on
// Tamagui components only once `TamaguiCustomConfig` is augmented with a real
// createTamagui config. The consuming APPS each do this in their own
// tamagui.config.ts (apps/pwa + apps/mobile both `declare module "tamagui"`),
// and their programs type these sources through that augmentation — which is
// why the apps typecheck clean regardless of this file.
//
// This package's own `bun run check`, however, has no app config in its
// program. Before kit 0.3.0-alpha.126 the augmentation leaked in through the
// kit's main types entry; the 126 types restructure (index → _public
// indirection) stopped that, breaking `check` with "Property 'items' does not
// exist" across every file using shorthands. Pull the kit's own config
// augmentation in explicitly (type-only — erased at runtime; the /provider
// module itself is never imported at runtime by this package).
//
// NOTE: this is an ambient .d.ts inside `src`, so ONLY this package's tsc
// (include: ["src"]) loads it. Consuming apps never see it — no risk of
// double-merging with their own TamaguiCustomConfig declarations.

import type { AppConfig } from "@stageholder/ui/provider";

declare module "tamagui" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface TamaguiCustomConfig extends AppConfig {}
}
