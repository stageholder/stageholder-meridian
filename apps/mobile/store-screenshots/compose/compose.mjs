// Store marketing frames from real app screenshots.
//   node compose.mjs            → App Store 6.9" (1320×2868) into out/ios/
//   node compose.mjs play       → Google Play phone (1080×2160, 1:2) into out/play/
//   node compose.mjs feature    → Google Play feature graphic (1024×500) into out/play/
import { chromium } from "/Users/garda_dafi/Project/stageholder-meridian/node_modules/@playwright/test/index.mjs";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const mode = process.argv[2] ?? "ios";
const frames = JSON.parse(readFileSync(join(here, "frames.json"), "utf8"));
const SHOTS = process.env.SHOTS_DIR ?? join(here, "..", "raw-6.3");
const PRESETS = {
  ios:  { W: 1320, H: 2868, out: "ios",  k: 1,     top: 1010, scale: 0.90 },
  play: { W: 1080, H: 2160, out: "play", k: 0.82,  top: 760,  scale: 0.74 },
};
const FONT = `-apple-system,"SF Pro Display","SF Pro Text","Helvetica Neue",Inter,sans-serif`;

const frameHtml = (f, P) => `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:${P.W}px;height:${P.H}px;overflow:hidden;background:#07090d;font-family:${FONT};-webkit-font-smoothing:antialiased}
  .bg{position:absolute;inset:0;background:linear-gradient(180deg,#07090d 0%,#0a0e15 55%,${f.accent}1f 100%)}
  .rule{position:absolute;left:${104*P.k}px;top:${168*P.k}px;width:${72*P.k}px;height:${8*P.k}px;border-radius:4px;background:${f.accent}}
  .copy{position:absolute;left:${104*P.k}px;right:${104*P.k}px;top:${214*P.k}px;color:#fff}
  .kicker{font-size:${34*P.k}px;font-weight:600;letter-spacing:.02em;color:${f.accent};margin:0 0 ${26*P.k}px}
  h1{margin:0;font-size:${(f.h1 ?? 118)*P.k}px;line-height:1.03;font-weight:700;letter-spacing:-.03em;max-width:${1120*P.k}px}
  p{margin:${34*P.k}px 0 0;font-size:${46*P.k}px;line-height:1.32;font-weight:400;color:rgba(255,255,255,.72);max-width:${1040*P.k}px}
  .stage{position:absolute;left:50%;top:${P.top}px;transform:translateX(-50%)}
  .device{width:1206px;height:2622px;transform:scale(${P.scale});transform-origin:top center;border-radius:148px;overflow:hidden;background:#000;box-shadow:0 0 0 12px #16191f,0 0 0 15px rgba(255,255,255,.10),0 60px 140px rgba(0,0,0,.6)}
  .device img{display:block;width:1206px;height:2622px}
  .island{position:absolute;left:50%;top:40px;transform:translateX(-50%);width:372px;height:112px;border-radius:60px;background:#000}
</style></head><body>
<div class="bg"></div><div class="rule"></div>
<div class="copy"><div class="kicker">${f.kicker}</div><h1>${f.title}</h1><p>${f.subtitle}</p></div>
<div class="stage"><div class="device"><img src="file://${join(SHOTS, f.shot)}"><div class="island"></div></div></div>
</body></html>`;

const featureHtml = (icon) => `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:1024px;height:500px;overflow:hidden;background:#07090d;font-family:${FONT};-webkit-font-smoothing:antialiased;color:#fff}
  .bg{position:absolute;inset:0;background:linear-gradient(135deg,#07090d 0%,#0b1220 60%,#f59e0b26 100%)}
  .icon{position:absolute;left:72px;top:110px;width:280px;height:280px;border-radius:64px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.6)}
  .icon img{width:100%;height:100%;display:block}
  .copy{position:absolute;left:412px;top:118px;right:64px}
  .name{font-size:72px;font-weight:700;letter-spacing:-.03em;line-height:1}
  .tag{margin-top:22px;font-size:30px;line-height:1.3;color:rgba(255,255,255,.78)}
  .rings{position:absolute;right:64px;bottom:44px;display:flex;gap:10px}
  .rings i{display:block;width:16px;height:16px;border-radius:50%}
</style></head><body><div class="bg"></div>
<div class="icon"><img src="file://${icon}"></div>
<div class="copy"><div class="name">Meridian</div><div class="tag">Tasks, habits and a private journal, closed into one set of rings every day.</div></div>
<div class="rings"><i style="background:#facc15"></i><i style="background:#f97316"></i><i style="background:#ef4444"></i></div>
</body></html>`;

const browser = await chromium.launch();
if (mode === "feature") {
  const icon = process.env.ICON ?? "/Users/garda_dafi/Project/stageholder-meridian/apps/mobile/assets/icon.png";
  const page = await browser.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  const file = join(here, "frame-feature.html"); writeFileSync(file, featureHtml(icon));
  await page.goto(`file://${file}`); await page.waitForTimeout(300);
  mkdirSync(join(here, "out", "play"), { recursive: true });
  await page.screenshot({ path: join(here, "out", "play", "feature-graphic-1024x500.png") }); console.log("wrote feature graphic");
} else {
  const P = PRESETS[mode]; if (!P) throw new Error(`unknown preset ${mode}`);
  mkdirSync(join(here, "out", P.out), { recursive: true });
  const page = await browser.newPage({ viewport: { width: P.W, height: P.H }, deviceScaleFactor: 1 });
  for (const f of frames) {
    const file = join(here, `frame-${P.out}-${f.id}.html`); writeFileSync(file, frameHtml(f, P));
    await page.goto(`file://${file}`); await page.waitForTimeout(300);
    await page.screenshot({ path: join(here, "out", P.out, `${f.id}.png`), type: "png" }); console.log("wrote", P.out, f.id);
  }
}
await browser.close();
