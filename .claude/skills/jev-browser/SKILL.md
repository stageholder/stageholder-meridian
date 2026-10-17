---
name: jev-browser
description: Drive a real Chrome against the local Meridian/Hub dev stack with the `jevb` CLI (jev-browser-cli, TypeSafe Jev). Use when asked to smoke-test, verify a UI change in the browser, walk a user journey, reproduce a PWA bug, or read page state/console errors from the running app. Follow docs/testing/jev-browser-meridian-journeys.md.
---

# jev-browser for Meridian

`jevb` is installed globally (`bun add -g jev-browser-cli`) and authenticated per
machine (`jevb auth status` must show a `typesafe` source). Never start the dev
servers yourself; check they listen first:

```bash
lsof -nP -iTCP:4000 -iTCP:4001 -iTCP:4828 -iTCP:4829 -sTCP:LISTEN
```

PWA `:4001`, API `:4000`, Hub API/OIDC `:4828`, Hub web `:4829`. Sign-in
happens on the Hub page, never on a Meridian page. If a port is missing, stop
and ask the operator to run `bun run dev:pwa` here (PWA + API) and `bun run dev`
in `~/Project/stageholder-identity`.

`jevb` drives Chrome only: it covers the PWA (and the Tauri desktop app, which
wraps the same PWA). It cannot drive the Expo native app; native changes still
get verified by the operator on a device or simulator.

## Loop per step

1. `jevb page open mer-<journey> <url> --json` (one session per journey,
   short names; long names overflow the macOS 103-byte socket path).
2. `jevb page snapshot mer-<j> -i --json` to get `@eN` refs.
3. Deterministic action first: `jevb element fill mer-<j> @eN "text"`,
   `jevb element click mer-<j> @eN`, `jevb element find mer-<j> role button
click --name "Save"`. Use Jev only for obvious primary buttons or to pick
   among similar rows: `jevb page act mer-<j> "click Save" --json
--non-interactive`.
4. Verify against page state, not model confidence: `jevb page get mer-<j>
url --json`, `jevb page get mer-<j> text <sel>`, `jevb page wait mer-<j>
--text "Saved"`, `jevb console errors mer-<j> --json`.
5. `page act` exit codes: 0 ok/preview, 1 error, 2 needs `--confirm <id>`,
   3 execution unknown. Never replay a write after 3.
6. Screenshot for evidence: `jevb page screenshot mer-<j> --annotate <path>`
   into the scratchpad.
7. `jevb session close mer-<j>` when done.

## Rules

- Secrets (Hub password, journal passphrase, recovery codes) only via
  `--value-stdin` on `page act --op fill`; never in an instruction string,
  argument, or URL.
- Test data is prefixed `JEVB ` and test users use
  `jevb+<label>-<ts>@e2e.stageholder.com`.
- Write journeys only on the local stack. Production is read-only.
- No `data-testid` in the PWA: use roles, labels, or snapshot refs.
- The journal key lives in memory only. Every reload, new session, or
  `state load` locks the journal again; unlock with the passphrase before any
  journal step.
- Run every `jevb` command from the repo root: `jevb` reads
  `jev-browser.json` from the cwd, and that file opens a visible Chrome window
  (`"headed": true`) so the operator can watch.
- Reuse a login with `jevb state save/load <scratchpad>/<file>.json`; state
  files hold live tokens, never commit them.
- Report findings as what the page showed, with URL and the failing
  assertion; file them under the "Run log" in
  `docs/testing/jev-browser-meridian-journeys.md`.
- Tool manual: `jevb skill get jev-browser --full`.
- Anything worth checking again goes into the Playwright suite
  (`apps/pwa/e2e/`, run `cd apps/pwa && bun run e2e`): Jev is for
  exploring and reproducing, the suite is the regression net. After a
  feature change, run the suite first, then use Jev on what it does not
  cover.
- Jev declines to fill password inputs (`NO_MATCH`): use
  `jevb element fill <s> 'input[type=password]' "$VAR"` with the value from
  the gitignored `apps/pwa/e2e/.env.e2e`. Navigate with `page open <s> <url>`
  (`page navigate` does not move the page).
