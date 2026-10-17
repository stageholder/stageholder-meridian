import { config } from "@repo/eslint-config/react-internal";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...config,
  {
    // Playwright E2E journeys: not React and not run through turbo, so the
    // react-hooks / turbo-env rules misfire on them. They are type-checked by
    // `tsc -p e2e` (part of `bun run check`).
    ignores: ["e2e/**", "playwright.config.ts", "playwright-report/**", "test-results/**"],
  },
];
