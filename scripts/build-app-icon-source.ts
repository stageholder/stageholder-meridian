#!/usr/bin/env bun
/**
 * Build a 1024x1024 app-icon source: the colored Meridian spiral centered on
 * a solid tile painted in the app's OWN dark background color, full-bleed to
 * the canvas edges. macOS then applies its squircle mask, yielding a proper
 * dock icon whose tile matches the in-app dark surface (not the lighter navy
 * the brand-on-navy asset used to bake in).
 *
 * Source is `meridian_mark.png` — the transparent spiral (rings only, no
 * tile), so we control the background here. Tile color is derived from the
 * dark theme token `--background: oklch(0.15 0.02 210)` (apps/pwa/globals.css)
 * so the icon stays in sync with the app surface if that token changes.
 *
 * Run AFTER any logo/color update, then regenerate every size/format:
 *   bun scripts/build-app-icon-source.ts
 *   bun --filter=desktop run tauri icon \
 *     apps/desktop/src-tauri/icons/app-icon-source.png
 *
 * Full-bleed + opaque (no transparent corner pixels) keeps macOS Sequoia from
 * wrapping the icon in its default white "template" plate.
 */
import sharp from "sharp";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dir, "..");
const SRC = path.join(REPO_ROOT, "apps/pwa/public/logo/meridian_mark.png");
const OUT = path.join(
  REPO_ROOT,
  "apps/desktop/src-tauri/icons/app-icon-source.png",
);

const CANVAS = 1024;
// Fraction of the canvas the spiral mark occupies; the remainder is even
// padding so the rings don't crowd the squircle edge (macOS icon grid leaves
// the glyph inset from the tile).
const MARK_SCALE = 0.62;

// oklch(L C H) → sRGB (Björn Ottosson reference math). Kept inline so the tile
// color is computed straight from the theme token, no hand-copied hex to drift.
function oklchToRgb(L: number, C: number, H: number) {
  const hr = (H * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const enc = (c: number) => {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(v * 255)));
  };
  return { r: enc(lr), g: enc(lg), b: enc(lb), alpha: 1 };
}

// --background, dark theme (apps/pwa/src/globals.css).
const bg = oklchToRgb(0.15, 0.02, 210);
console.log(
  `Tile color (oklch 0.15 0.02 210) = rgb(${bg.r}, ${bg.g}, ${bg.b})`,
);

const markSize = Math.round(CANVAS * MARK_SCALE);
const mark = await sharp(SRC)
  .resize(markSize, markSize, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .toBuffer();

await sharp({
  create: { width: CANVAS, height: CANVAS, channels: 4, background: bg },
})
  .composite([{ input: mark, gravity: "center" }])
  .png()
  .toFile(OUT);

console.log(`Wrote ${OUT} (${CANVAS}x${CANVAS})`);
