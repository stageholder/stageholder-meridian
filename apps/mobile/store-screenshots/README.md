# Store screenshots

Real captures from the iPhone 17 simulator (local stack, seeded account "Nadia Rahman"), framed with a headline per screen. Same seven screens for both stores, in order: Today, Journey, The path, Habits, Todos, Journal, Calendar.

- `ios-6.3-marketing/` — 1206×2622 PNG for the **iPhone with Dynamic Island (medium display)** slot on the App Store Connect product page. Upload these first.
- `ios-6.9-marketing/` — 1320×2868 PNG, the large-display size available under **View All Sizes in Media Manager**.
- `ios-header/header-3840x1646.png` — the landscape banner for App Store Connect's **Header and Search Results** tab (the product-page header slot; it is not a screenshot slot).
- `raw-6.3/` — the untouched 1206×2622 captures. Valid as-is for the 6.3" slot, and the source for every frame.
- `play-phone/` — 1080×2160 PNG (exactly 1:2, the Play limit is 2:1) for the Google Play phone screenshots, plus `feature-graphic-1024x500.png`, which Play requires for the listing.
- `asc-subscription-review/paywall-review.png` — the in-app paywall for the **Review Information → Screenshot** field of each auto-renewable subscription in App Store Connect (one file serves both products). Prices shown are the App Store prices ($2.99 / $19.99).
- `compose/` — `node compose.mjs` (App Store 6.9"), `node compose.mjs ios63` (6.3"), `node compose.mjs play`, `node compose.mjs feature`, `node compose.mjs header` re-render from `raw-6.3/` with the copy in `frames.json`. Needs the repo's Playwright Chromium. Output lands in `compose/out/`.
