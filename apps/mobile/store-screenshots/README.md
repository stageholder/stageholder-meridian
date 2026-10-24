# Store screenshots

Real captures from the iPhone 17 simulator (local stack, seeded account "Nadia Rahman"), framed with a headline per screen. Same seven screens for both stores, in order: Today, Journey, The path, Habits, Todos, Journal, Calendar.

- `ios-6.9-marketing/` — 1320×2868 PNG, the 6.9" iPhone slot in App Store Connect (Apple scales it down for smaller phones).
- `raw-6.3/` — the untouched 1206×2622 captures. Valid as-is for the 6.3" slot, and the source for every frame.
- `play-phone/` — 1080×2160 PNG (exactly 1:2, the Play limit is 2:1) for the Google Play phone screenshots, plus `feature-graphic-1024x500.png`, which Play requires for the listing.
- `asc-subscription-review/paywall-review.png` — the in-app paywall for the **Review Information → Screenshot** field of each auto-renewable subscription in App Store Connect (one file serves both products). Prices shown are the App Store prices ($2.99 / $19.99).
- `compose/` — `node compose.mjs` (App Store), `node compose.mjs play`, `node compose.mjs feature` re-render from `raw-6.3/` with the copy in `frames.json`. Needs the repo's Playwright Chromium. Output lands in `compose/out/`.
