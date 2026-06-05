// Metro config for the Meridian Bun-workspace monorepo.
//
// 1. watchFolders extends Metro's reach to the monorepo root so any shared
//    workspace package changes hot-reload here.
// 2. nodeModulesPaths lets Metro resolve from the project's node_modules
//    first, falling back to the monorepo root (where bun hoists shared deps).
// 3. unstable_enablePackageExports turns on `package.json#exports` resolution
//    so `import "@stageholder/sdk/react-native"` lands at
//    dist/react-native/index.js without dragging in the /react bundle.
// 4. resolveRequest dedupe — CRITICAL for monorepos. Without it, Metro sees
//    TWO copies of react / react-native / expo (one hoisted at monorepo root,
//    one at apps/mobile/node_modules) and codegen babel chokes on the
//    duplicate, killing Metro before it binds 8081. Forcing the origin path
//    to a file inside this project makes Metro always pick the project-local
//    copy.
// 5. withTamagui wraps the config — Tamagui's officially recommended Metro
//    integration. It loads tamagui.config.ts, watches it for changes, and
//    enables compile-time optimizations on production builds. We apply it
//    LAST so our dedupe + workspace path setup runs first.

const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

// Soft-require so Metro doesn't crash if the plugin isn't installed yet.
// Once `bun install` runs, this picks up the real plugin and the wrap
// below activates. Until then, we ship a no-op identity wrapper — the
// app still bundles, you just don't get the compile-time CSS extraction
// optimization (which is irrelevant during dev anyway).
let withTamagui = (config) => config;
try {
  withTamagui = require("@tamagui/metro-plugin").withTamagui;
} catch {
  console.warn(
    "[meridian] @tamagui/metro-plugin not installed — skipping Tamagui Metro " +
      "optimization. Run `bun install` from the repo root to enable it.",
  );
}

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = false;
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_enableSymlinks = true;

// Prefer `import` / `module` conditions over `require` when resolving
// conditional package exports.
//
// Critical for Tamagui v2: its packages have conditional exports where the
// `require` branch points to `dist/cjs/...` and the `import` branch points
// to `dist/esm/...` — DIFFERENT files. Each file calls
// `createContext("")` for `ThemeStateContext` at the top level, so loading
// both creates two React contexts. `TamaguiProvider` (reached via ESM)
// sets context in one; `@tamagui/helpers-icon`'s `IconWrapper` (reached via
// CJS — visible in stack traces as `dist/cjs/themed.native.js`) reads from
// the other and gets `null`, throwing MISSING_THEME_MESSAGE.
//
// Forcing `import` first makes every conditional export resolve to the ESM
// file regardless of caller (CJS or ESM), so there is a single module
// instance and a single context. `require` and `default` stay as fallbacks
// for packages that only ship CJS.
config.resolver.unstable_conditionNames = [
  "react-native",
  "import",
  "module",
  "require",
  "default",
];

// Ensure `.native.*` variants resolve BEFORE web variants — same pattern
// as the kit's own reference app (stageholder-ui/apps/docs-expo/
// metro.config.js). The kit's dist ships dual `Foo.mjs` (web) +
// `Foo.native.js` (RN) builds; with Expo's default sourceExts, `.mjs` is
// tried before `.js`, so Metro picks the WEB build on native — e.g.
// `<ActivityRings>` rendering raw HTML `<svg><circle/>` and throwing
// "View config getter callback for component `circle` must be a
// function". Prepending the compound native extensions makes the RN
// build win wherever one exists, while web-only `.mjs` packages still
// resolve via the default tail.
config.resolver.sourceExts = [
  ...new Set([
    "native.tsx",
    "native.ts",
    "native.jsx",
    "native.js",
    ...(config.resolver.sourceExts ?? []),
  ]),
];


const dedupedPackages = [
  "react",
  "react-dom",
  "react-native",
  "expo",
  "expo-modules-core",
  "expo-router",
  "expo-auth-session",
  "expo-crypto",
  "expo-secure-store",
  "expo-web-browser",
  "expo-linking",
  "expo-constants",
  "expo-status-bar",
  "expo-haptics",
  "@react-native-async-storage/async-storage",
  "react-native-safe-area-context",
  "react-native-screens",
  "react-native-svg",
  "react-native-gesture-handler",
  "react-native-reanimated",
  "react-native-worklets",
  "@expo/metro-runtime",
  // Tamagui family — without dedupe, Metro can pick up two copies (one
  // hoisted at the workspace root, one nested in @stageholder/ui's deps)
  // and the second copy of `tamagui` re-creates a fresh internal store, so
  // theme/brand context inside @stageholder/ui's components reads `null`
  // while context set in this app reads correctly. Forcing a single
  // resolution path fixes the cross-package context cascade. We list every
  // sub-package that has its own internal state — core, web, native — so
  // none of them slip through.
  "tamagui",
  "@tamagui/core",
  "@tamagui/web",
  "@tamagui/native",
  "@tamagui/config",
];

// Native-only optional integrations of @stageholder/ui that this app does
// NOT (yet) ship. Metro doesn't tree-shake the kit's barrel, so e.g.
// RichTextEditor.native's static `import ... from "@10play/tentap-editor"`
// resolves on EVERY bundle even though we never render the editor (journal
// rich-text editing is web-only for now — see app/(authed)/journal.tsx).
// Stub them with @tamagui/proxy-worm — a Proxy that swallows any property
// access — exactly the pattern apps/pwa/vite.config.ts uses to stub
// native-only packages on web, just pointed the other way.
//
// To ADOPT one of these features natively: install the real packages in
// this app (they're native modules → `bunx expo prebuild` + rebuild) and
// remove them from this list.
// Two failure modes both land here:
//   1. Bundle-time: the package isn't installed at all (bun only auto-installs
//      FIRST-level kit peers) → "Unable to resolve module …".
//   2. Runtime: bun auto-installed the kit peer's JS, but its native pod is
//      NOT autolinked (autolinking scans this app's deps, not hoisted
//      extras) → "Cannot find native module 'ExpoAudio'" at import time.
const stubbedModules = [
  "@10play/tentap-editor", // kit RichTextEditor/RichTextRenderer .native host
  "react-native-keyboard-controller", // tentap's keyboard-avoidance peer
  "expo-audio", // kit AudioPlayer / media controller
  "expo-blur", // kit GlassSurface (nothing we render composes it)
  "expo-image-manipulator", // kit ImageCrop.native
  "expo-location", // kit Map/MapboxPicker user-location
  "@maplibre/maplibre-react-native", // kit Map.native
  "@rnmapbox/maps", // kit Map.native (mapbox flavor)
];

const projectOriginPath = path.join(projectRoot, "package.json");
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    stubbedModules.includes(moduleName) ||
    stubbedModules.some((s) => moduleName.startsWith(`${s}/`))
  ) {
    return context.resolveRequest(
      { ...context, originModulePath: projectOriginPath },
      "@tamagui/proxy-worm",
      platform,
    );
  }
  const root = moduleName.split("/")[0];
  const scoped = moduleName.startsWith("@")
    ? moduleName.split("/").slice(0, 2).join("/")
    : null;
  if (
    dedupedPackages.includes(moduleName) ||
    dedupedPackages.includes(root) ||
    (scoped && dedupedPackages.includes(scoped))
  ) {
    return context.resolveRequest(
      { ...context, originModulePath: projectOriginPath },
      moduleName,
      platform,
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Tamagui's Metro plugin — wraps our config to add compile-time optimization
// + config-file watching. Per the v2 docs:
//   https://tamagui.dev/docs/guides/metro
//
// `components: ["tamagui", "@stageholder/ui"]` tells the plugin which
// packages to scan for components when extracting CSS at build time —
// listing both means our design-system primitives benefit from the
// optimization too, not just direct `tamagui` imports.
//
// `config: "./tamagui.config.ts"` is explicit (the plugin can auto-detect
// from `tamagui.build.ts` but we don't have that file).
module.exports = withTamagui(config, {
  components: ["tamagui", "@stageholder/ui"],
  config: "./tamagui.config.ts",
});
