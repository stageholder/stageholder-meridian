import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-vite-plugin";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // Anchor `root` and `envDir` to the directory of this config file so
  // Vite reads `.env*` from `apps/pwa/` regardless of where `bun dev`
  // was launched from. Without this, running `bun run dev:pwa` from the
  // monorepo root sometimes resolves cwd to the wrong place under
  // turbo's wrapper, and `import.meta.env.VITE_*` comes back undefined
  // — the failure mode you just hit ("VITE_API_URL is required").
  root: __dirname,
  envDir: __dirname,
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
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon/*", "logo/*", "robots.txt"],
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
