#!/usr/bin/env bun
/**
 * Build a 1024x1024 app-icon source by trimming the transparent padding
 * off meridian_dark.png (which has the colored spiral on a navy rounded
 * tile, surrounded by transparent space) and stretching the navy to the
 * canvas edges. macOS then applies its own squircle mask, yielding a
 * proper full-bleed dock icon.
 *
 * Run AFTER any logo update, then `bun --filter=desktop run tauri icon
 * apps/desktop/src-tauri/icons/app-icon-source.png` to regenerate every
 * size/format Tauri ships.
 *
 * Why this exists: without trimming, the source's internal rounded
 * corners + transparent border end up nested inside the macOS squircle,
 * leaving white/empty space around a small visible icon (the "double
 * rounding" problem).
 */
import sharp from "sharp";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dir, "..");
const SRC = path.join(REPO_ROOT, "apps/pwa/public/logo/meridian_dark.png");
const OUT = path.join(
  REPO_ROOT,
  "apps/desktop/src-tauri/icons/app-icon-source.png",
);

const CANVAS = 1024;

// trim() removes a uniform-color border (alpha=0 here). The result is a
// tight bounding box around the navy rounded tile + spiral.
const trimmed = await sharp(SRC).trim().toBuffer();

// Sample the navy from the top-left of the trimmed image. The corner is
// always the rounded-tile fill, never spiral content.
const tlPx = await sharp(trimmed)
  .extract({ left: 4, top: 4, width: 1, height: 1 })
  .raw()
  .toBuffer();
const navy = {
  r: tlPx[0],
  g: tlPx[1],
  b: tlPx[2],
  alpha: 1,
};
console.log(`Sampled navy: rgb(${navy.r}, ${navy.g}, ${navy.b})`);

// `fit: contain` letterboxes the source into the exact CANVAS×CANVAS box,
// then `.flatten()` composites the image onto a solid navy background so
// every pixel is opaque navy or part of the spiral. No transparent corner
// pixels means macOS Sequoia won't wrap the icon in its default white
// "template" plate.
await sharp(trimmed)
  .resize(CANVAS, CANVAS, { fit: "contain", background: navy })
  .flatten({ background: navy })
  .png()
  .toFile(OUT);

console.log(`Wrote ${OUT} (${CANVAS}x${CANVAS})`);
