import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-vite-plugin";
import { VitePWA } from "vite-plugin-pwa";
import { tamaguiPlugin } from "@tamagui/vite-plugin";

export default defineConfig({
  // Anchor `root` and `envDir` to the directory of this config file so
  // Vite reads `.env*` from `apps/pwa/` regardless of where `bun dev`
  // was launched from. Without this, running `bun run dev:pwa` from the
  // monorepo root sometimes resolves cwd to the wrong place under
  // turbo's wrapper, and `import.meta.env.VITE_*` comes back undefined
  // — the failure mode you just hit ("VITE_API_URL is required").
  root: __dirname,
  envDir: __dirname,
  // `@tamagui/vite-plugin` sets `envPrefix: ["TAMAGUI_"]` in its config
  // hook, which CLOBBERS Vite's default `["VITE_"]` and makes every
  // `import.meta.env.VITE_*` come back undefined. Setting envPrefix at
  // the user-config level takes precedence over plugin config, so we
  // re-include both prefixes here. Drop the "TAMAGUI_" entry only when
  // we're certain nothing reads a `TAMAGUI_*` env var.
  envPrefix: ["VITE_", "TAMAGUI_"],
  plugins: [
    // Must run BEFORE the React plugin so the route tree is generated
    // before React compilation picks it up.
    TanStackRouterVite({
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
      quoteStyle: "double",
      semicolons: true,
    }),
    react(),
    tailwindcss(),
    // `@tamagui/vite-plugin` handles react-native-web aliasing, JSX
    // transforms for Tamagui's styled() API, and (in production)
    // static CSS extraction.
    //
    // Two things that have to be inline (NOT moved to tamagui.build.ts):
    //
    // 1. `buildFile` — the static-worker resolves a relative build path
    //    against `process.cwd()`, and Turbo invokes `dev:pwa` from the
    //    monorepo root, not from this app. Pass an absolute path so the
    //    worker finds our build options regardless of cwd. (See
    //    node_modules/@tamagui/static-worker/.../loadTamagui.cjs:125.)
    //
    // 2. `disableWatchTamaguiConfig: true` — duplicated here from
    //    tamagui.build.ts as a safety net. If the worker still can't
    //    locate the build file, this flag short-circuits the heavy
    //    component-loading path that would otherwise pull in
    //    @tamagui/react-native-web-lite (broken under React 19).
    tamaguiPlugin({
      buildFile: path.resolve(__dirname, "tamagui.build.ts"),
      // Together with `disableExtraction: true` (from tamagui.build.ts),
      // this is the only combination that satisfies the extractor's
      // `isFullyDisabled` gate (see
      // node_modules/@tamagui/static-worker/.../createExtractor.cjs:71).
      // When the gate is true, `extractor.load()` skips the heavy
      // `loadTamagui` call that pulls in
      // `@tamagui/react-native-web-lite/src/AppRegistry/index.tsx` —
      // which still imports React-19-removed `unmountComponentAtNode`.
      // Tradeoff: no `data-tamagui-*` debug attributes in the DOM.
      disableExtraction: true,
      disableDebugAttr: true,
      disableWatchTamaguiConfig: true,
    }),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon/*", "logo/*", "robots.txt"],
      // We register the SW manually from main.tsx so we can gate it on
      // `window.location.protocol` — WebKit rejects ServiceWorker.register()
      // on non-http(s) origins (Tauri's tauri:// scheme), and the default
      // auto-injected registerSW.js doesn't check first.
      injectRegister: false,
      // Explicitly disable the PWA plugin in dev. The default already
      // skips SW generation in `vite dev`, but a stale SW from a previous
      // dev session can still be active in the browser — adding this
      // makes the no-SW-in-dev guarantee structural rather than implicit.
      devOptions: { enabled: false },
      manifest: {
        name: "Meridian",
        short_name: "Meridian",
        description: "Manage your todos, journal, and habits with Meridian",
        theme_color: "#0e7490",
        background_color: "#0a0a0a",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/favicon/web-app-manifest-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/favicon/web-app-manifest-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/favicon/web-app-manifest-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Don't precache API calls or the auth catch-all — only the static shell.
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/auth\//, /^\/api\//],
      },
    }),
  ],
  resolve: {
    alias: [
      // Redirect every import of `@tamagui/react-native-web-lite` to the
      // full `react-native-web` package. Tamagui rc.42's lite build
      // still imports `unmountComponentAtNode` from `react-dom`, which
      // React 19 removed — see
      // https://react.dev/blog/2024/04/25/react-19-upgrade-guide#removed-unmountcomponentatnode.
      // `@tamagui/core` depends on the lite package directly, so the
      // plugin's `react-native → react-native-web` alias alone doesn't
      // cover it. The full `react-native-web@0.21.2` is React 19
      // compatible and is already pinned in this app's deps. Only the
      // bare specifier is aliased — lite and full RNW have different
      // internal directory structures, so deep paths would mis-resolve.
      {
        find: /^@tamagui\/react-native-web-lite$/,
        replacement: "react-native-web",
      },
      // Stub out native-only packages with @tamagui/proxy-worm, a Proxy
      // that swallows any property access and returns itself. The kit's
      // web bundle indirectly references some of these via Tamagui
      // sub-package side effects (Sheet/Toast/Adapt → @tamagui/native →
      // setup-* helpers that `require()` native packages). None of them
      // are usable on web; without stubs, their module-level code
      // crashes when esbuild tries to bundle them — e.g.
      // `react-native-worklets/.../NativeWorkletsModule.js` does
      // `TurboModuleRegistry.get("WorkletsModule")` at import time and
      // TurboModuleRegistry is undefined under react-native-web.
      //
      // The proxy lets any chain of property access / function calls
      // succeed silently — Tamagui's web runtime checks `isEnabled`
      // flags before actually using these modules, so the no-op path is
      // safe.
      {
        find: /^react-native-worklets(\/.*)?$/,
        replacement: "@tamagui/proxy-worm",
      },
      {
        find: /^react-native-worklets-core(\/.*)?$/,
        replacement: "@tamagui/proxy-worm",
      },
      {
        find: /^react-native-reanimated(\/.*)?$/,
        replacement: "@tamagui/proxy-worm",
      },
      {
        find: /^react-native-gesture-handler(\/.*)?$/,
        replacement: "@tamagui/proxy-worm",
      },
      {
        find: /^react-native-screens(\/.*)?$/,
        replacement: "@tamagui/proxy-worm",
      },
      {
        find: /^@\/components\//,
        replacement: path.resolve(__dirname, "src/components") + "/",
      },
      {
        find: /^@\/hooks\//,
        replacement: path.resolve(__dirname, "src/hooks") + "/",
      },
      {
        find: /^@\/lib\//,
        replacement: path.resolve(__dirname, "src/lib") + "/",
      },
      {
        find: /^@\/providers\//,
        replacement: path.resolve(__dirname, "src/providers") + "/",
      },
      {
        find: /^@\/stores\//,
        replacement: path.resolve(__dirname, "src/stores") + "/",
      },
      {
        find: /^@\/types\//,
        replacement: path.resolve(__dirname, "src/types") + "/",
      },
      {
        find: /^@\/utils\//,
        replacement: path.resolve(__dirname, "src/utils") + "/",
      },
      { find: /^@\//, replacement: path.resolve(__dirname, "src") + "/" },
    ],
  },
  server: { port: 4001, strictPort: true },
  preview: { port: 4001, strictPort: true },
  build: {
    sourcemap: true,
    target: "es2022",
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Split heavy domain deps into their own chunks. Most pages don't
        // import tiptap or recharts; pre-splitting keeps the main bundle small.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("@tiptap") || id.includes("prosemirror")) {
            return "tiptap";
          }
          if (id.includes("recharts") || id.includes("d3-")) return "recharts";
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/scheduler/")
          ) {
            return "react-vendor";
          }
          if (id.includes("@tanstack")) return "query-router";
          return undefined;
        },
      },
    },
  },
});
