# Tamagui v2.0.0 Stable Upgrade — Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. **Project constraints override the default skill workflow:** NO test files, NO `git` commands, NO build/`tsc` runs in steps. Verification = `mcp__ide__getDiagnostics` + reading. `bun install` and `bun run dev:pwa`/`build:pwa` are **user-run gates** (the user verifies manually).

**Goal:** Move the whole workspace from Tamagui `rc.41`/`rc.42` to `2.0.0` stable + `@stageholder/ui@^0.3.0-alpha.6`, modernize the PWA's responsive behavior onto the kit's media primitives, and shed dead code — without breaking the React-19 + Tailwind-coexistence build.

**Architecture:** Bun + Turborepo monorepo. `apps/pwa` = Vite + TanStack Router SPA (Tailwind v4 + Tamagui coexisting). `@stageholder/ui` is the canonical kit. Mobile is deferred (empty `app/`); only its dep specifiers move for lockfile consistency.

**Tech Stack:** Tamagui v2.0.0, `@stageholder/ui` alpha.6, Vite, TanStack Router, React 19, Bun.

**Source spec:** `docs/superpowers/specs/2026-05-31-tamagui-v2-stable-upgrade-design.md`

**Execution order:** Phase 1 (deps) → user `bun install` gate → Phase 3 (responsive) → Phase 4 (cleanups) → Phase 2 (config alignment — OPTIONAL, gated) → final user build/visual gate. Phase 2 is last because it is the only risk-bearing, runtime-verified change.

---

## Phase 1 — Dependency upgrade to Tamagui 2.0.0 stable

### Task 1: Root `package.json` — bump `resolutions` + `overrides`

**Files:** Modify `package.json` (root)

- [ ] **Step 1: Replace the `resolutions` block (lines 55-62).**

Replace:

```json
  "resolutions": {
    "@tamagui/core": "2.0.0-rc.42",
    "@tamagui/web": "2.0.0-rc.42",
    "@tamagui/react-native-web-lite": "2.0.0-rc.42",
    "tamagui": "2.0.0-rc.42",
    "@types/react": "19.2.2",
    "@types/react-dom": "19.2.2"
  },
```

with:

```json
  "resolutions": {
    "@tamagui/core": "2.0.0",
    "@tamagui/web": "2.0.0",
    "@tamagui/react-native-web-lite": "2.0.0",
    "tamagui": "2.0.0",
    "@types/react": "19.2.2",
    "@types/react-dom": "19.2.2"
  },
```

- [ ] **Step 2: Replace the `overrides` block (lines 63-75).**

Replace:

```json
  "overrides": {
    "tamagui": "2.0.0-rc.42",
    "@tamagui/core": "2.0.0-rc.42",
    "@tamagui/web": "2.0.0-rc.42",
    "@tamagui/config": "2.0.0-rc.42",
    "@tamagui/animations-css": "2.0.0-rc.42",
    "@tamagui/lucide-icons-2": "2.0.0-rc.42",
    "@tamagui/toast": "2.0.0-rc.42",
    "@tamagui/vite-plugin": "2.0.0-rc.42",
    "@tamagui/babel-plugin": "2.0.0-rc.42",
    "@tamagui/react-native-web-lite": "2.0.0-rc.42",
    "react-native-web": "0.21.2"
  }
```

with:

```json
  "overrides": {
    "tamagui": "2.0.0",
    "@tamagui/core": "2.0.0",
    "@tamagui/web": "2.0.0",
    "@tamagui/config": "2.0.0",
    "@tamagui/animations-css": "2.0.0",
    "@tamagui/lucide-icons-2": "2.0.0",
    "@tamagui/toast": "2.0.0",
    "@tamagui/vite-plugin": "2.0.0",
    "@tamagui/babel-plugin": "2.0.0",
    "@tamagui/react-native-web-lite": "2.0.0",
    "react-native-web": "0.21.2"
  }
```

- [ ] **Step 3: Verify** — re-read the file; confirm no `rc.42` remains and JSON is valid.

### Task 2: `apps/pwa/package.json` — bump Tamagui deps + add `@tamagui/toast` + kit alpha.6

**Files:** Modify `apps/pwa/package.json`

- [ ] **Step 1: Bump `@stageholder/ui` (line 26).** Replace `"@stageholder/ui": "^0.3.0-alpha.5",` with `"@stageholder/ui": "^0.3.0-alpha.6",`

- [ ] **Step 2: Bump the four Tamagui deps + add `@tamagui/toast` (lines 27-29, plus line 51).** Replace:

```json
    "@tamagui/config": "2.0.0-rc.42",
    "@tamagui/lucide-icons-2": "2.0.0-rc.42",
    "@tamagui/vite-plugin": "2.0.0-rc.42",
```

with:

```json
    "@tamagui/config": "2.0.0",
    "@tamagui/lucide-icons-2": "2.0.0",
    "@tamagui/toast": "2.0.0",
    "@tamagui/vite-plugin": "2.0.0",
```

(`@tamagui/toast` is a required kit peer — the PWA renders the kit's Toast/ToastProvider/Toaster. It was previously only force-pinned via root overrides without being a direct dep.)

- [ ] **Step 3: Bump `tamagui` (line 51).** Replace `"tamagui": "2.0.0-rc.42",` with `"tamagui": "2.0.0",`

- [ ] **Step 4: Verify** — re-read; confirm alphabetical-ish ordering preserved and no `rc.42` remains.

### Task 3: `packages/features/package.json` — kit alpha.6

**Files:** Modify `packages/features/package.json`

- [ ] **Step 1: Bump the devDependency (line 42).** Replace `"@stageholder/ui": "^0.3.0-alpha.5",` with `"@stageholder/ui": "^0.3.0-alpha.6",` (the `peerDependencies` entry stays `"*"`).

### Task 4: `apps/mobile/package.json` — minimal version bump (deferred UI; lockfile consistency only)

**Files:** Modify `apps/mobile/package.json`

> Rationale: prerelease ranges (`^2.0.0-rc.41`) do not resolve up to `2.0.0` stable, so leaving mobile on rc while root overrides force `core`/`web` to stable would split the `@tamagui` family in the install graph. No mobile UI/screens/setup work here.

- [ ] **Step 1: Bump `@stageholder/ui` (line 23).** Replace `"@stageholder/ui": "^0.3.0-alpha.5",` with `"@stageholder/ui": "^0.3.0-alpha.6",`

- [ ] **Step 2: Bump the runtime Tamagui deps + swap lucide-icons → lucide-icons-2 + add toast (lines 24-28).** Replace:

```json
    "@tamagui/config": "^2.0.0-rc.41",
    "@tamagui/core": "^2.0.0-rc.41",
    "@tamagui/lucide-icons": "^2.0.0-rc.41",
    "@tamagui/native": "^2.0.0-rc.41",
    "@tamagui/web": "^2.0.0-rc.41",
```

with:

```json
    "@tamagui/config": "^2.0.0",
    "@tamagui/core": "^2.0.0",
    "@tamagui/lucide-icons-2": "^2.0.0",
    "@tamagui/native": "^2.0.0",
    "@tamagui/toast": "^2.0.0",
    "@tamagui/web": "^2.0.0",
```

(The kit uses `@tamagui/lucide-icons-2` exclusively; the v1-named `@tamagui/lucide-icons` is unused. `@tamagui/toast` is a kit peer. Mobile has no icon imports yet, so this is a pure declaration change.)

- [ ] **Step 3: Bump `tamagui` (line 54).** Replace `"tamagui": "^2.0.0-rc.41",` with `"tamagui": "^2.0.0",`

- [ ] **Step 4: Bump the two devDependency plugins (lines 58-59).** Replace:

```json
    "@tamagui/babel-plugin": "^2.0.0-rc.41",
    "@tamagui/metro-plugin": "^2.0.0-rc.41",
```

with:

```json
    "@tamagui/babel-plugin": "^2.0.0",
    "@tamagui/metro-plugin": "^2.0.0",
```

- [ ] **Step 5: Verify** — re-read; confirm no `rc.41` remains and `@tamagui/lucide-icons` (v1) is gone.

### Task 5: USER GATE — install & resolve

- [ ] **Step 1 (user runs):** `bun install` from the repo root.
- [ ] **Step 2 (user verifies):** no `@stageholder/ui` peer-dependency warnings; the `@tamagui/*` family resolves to a single `2.0.0` line. Optional: `bunx tamagui check` for dependency consistency.
- [ ] **Step 3:** If install fails on `@tamagui/react-native-web-lite@2.0.0` not existing (package may be retired in stable), report back — the fix is to drop it from `resolutions`+`overrides` (Task 1) and rely on the Phase-2 alias instead.

---

## Phase 3 — Adopt the kit's responsive primitives

> Exact semantics (from `@stageholder/ui` `components/responsive.tsx`): `useMedia().md` is `true` when viewport ≥ 768px — an exact replacement for `useMediaQuery("(min-width: 768px)")`. `<Show above="md">` renders at ≥768; `<Hide above="md">` renders below 768.

### Task 6: `journal/route.tsx` — boolean via `useMedia().md`

**Files:** Modify `apps/pwa/src/routes/_app/journal/route.tsx`

- [ ] **Step 1: Swap the import (line 10) and drop the hook import (line 9).** Replace:

```ts
import { JournalSidebar } from "@/components/journal/journal-sidebar";
import { EncryptionGate } from "@/components/encryption/encryption-gate";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { View, XStack, YStack } from "@stageholder/ui";
```

with:

```ts
import { JournalSidebar } from "@/components/journal/journal-sidebar";
import { EncryptionGate } from "@/components/encryption/encryption-gate";
import { View, XStack, YStack, useMedia } from "@stageholder/ui";
```

- [ ] **Step 2: Swap the hook call (line 20).** Replace `  const isDesktop = useMediaQuery("(min-width: 768px)");` with `  const isDesktop = useMedia().md;`

- [ ] **Step 3: Verify** — `mcp__ide__getDiagnostics` on the file; no unresolved `useMediaQuery`/`useMedia` errors. (The `isDesktop || isChildRoute` boolean expressions are unchanged.)

### Task 7: `settings/index.tsx` — boolean via `useMedia().md`

**Files:** Modify `apps/pwa/src/routes/_app/settings/index.tsx`

- [ ] **Step 1: Add `useMedia` to the kit import (lines 9-17).** Replace:

```ts
import {
  Button,
  H1,
  Paragraph,
  SizableText,
  Tabs,
  XStack,
  YStack,
} from "@stageholder/ui";
```

with:

```ts
import {
  Button,
  H1,
  Paragraph,
  SizableText,
  Tabs,
  XStack,
  YStack,
  useMedia,
} from "@stageholder/ui";
```

- [ ] **Step 2: Remove the hook import (line 20).** Delete the line `import { useMediaQuery } from "@/lib/hooks/use-media-query";`

- [ ] **Step 3: Swap the hook call (line 45).** Replace `  const isDesktop = useMediaQuery("(min-width: 768px)");` with `  const isDesktop = useMedia().md;`

- [ ] **Step 4: Verify** — diagnostics clean; all the `isDesktop ? ... : ...` prop switches (orientation/variant/flexDirection/gap/width/justify) are untouched.

### Task 8: `todos/route.tsx` — `Show`/`Hide` for pure show/hide subtrees

**Files:** Modify `apps/pwa/src/routes/_app/todos/route.tsx`

- [ ] **Step 1: Drop the hook import (line 4) and add `Show`/`Hide` (lines 6-13).** Replace:

```ts
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { TodoListSidebar } from "@/components/todos/todo-list-sidebar";
import {
  Button,
  Drawer,
  View,
  VisuallyHidden,
  XStack,
  YStack,
} from "@stageholder/ui";
```

with:

```ts
import { TodoListSidebar } from "@/components/todos/todo-list-sidebar";
import {
  Button,
  Drawer,
  Hide,
  Show,
  View,
  VisuallyHidden,
  XStack,
  YStack,
} from "@stageholder/ui";
```

- [ ] **Step 2: Remove the hook call (line 20).** Delete `  const isDesktop = useMediaQuery("(min-width: 768px)");` (keep `const [sheetOpen, setSheetOpen] = useState(false);`).

- [ ] **Step 3: Wrap the desktop sidebar (lines 25-36).** Replace:

```tsx
{
  /* Desktop sidebar */
}
{
  isDesktop && (
    <View
      height="100%"
      width={256}
      shrink={0}
      borderRightWidth={1}
      borderColor="$borderColor"
    >
      <TodoListSidebar />
    </View>
  );
}
```

with:

```tsx
{
  /* Desktop sidebar */
}
<Show above="md">
  <View
    height="100%"
    width={256}
    shrink={0}
    borderRightWidth={1}
    borderColor="$borderColor"
  >
    <TodoListSidebar />
  </View>
</Show>;
```

- [ ] **Step 4: Wrap the mobile drawer (lines 38-51).** Replace:

```tsx
{
  /* Mobile sheet sidebar */
}
{
  !isDesktop && (
    <Drawer open={sheetOpen} onOpenChange={setSheetOpen}>
      <Drawer.Portal>
        <Drawer.Overlay />
        <Drawer.Content side="left" width={256} p={0}>
          <VisuallyHidden>
            <Drawer.Title>Todo Lists</Drawer.Title>
          </VisuallyHidden>
          <TodoListSidebar onNavigate={() => setSheetOpen(false)} />
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer>
  );
}
```

with:

```tsx
{
  /* Mobile sheet sidebar */
}
<Hide above="md">
  <Drawer open={sheetOpen} onOpenChange={setSheetOpen}>
    <Drawer.Portal>
      <Drawer.Overlay />
      <Drawer.Content side="left" width={256} p={0}>
        <VisuallyHidden>
          <Drawer.Title>Todo Lists</Drawer.Title>
        </VisuallyHidden>
        <TodoListSidebar onNavigate={() => setSheetOpen(false)} />
      </Drawer.Content>
    </Drawer.Portal>
  </Drawer>
</Hide>;
```

- [ ] **Step 5: Wrap the mobile sidebar trigger (lines 55-74).** Replace:

```tsx
{
  /* Mobile sidebar trigger */
}
{
  !isDesktop && (
    <XStack
      height={40}
      shrink={0}
      items="center"
      borderBottomWidth={1}
      borderColor="$borderColor"
      px="$4"
    >
      <Button
        intent="ghost"
        size="sm"
        icon={<ListFilter size={16} />}
        onPress={() => setSheetOpen(true)}
      >
        Lists
      </Button>
    </XStack>
  );
}
```

with:

```tsx
{
  /* Mobile sidebar trigger */
}
<Hide above="md">
  <XStack
    height={40}
    shrink={0}
    items="center"
    borderBottomWidth={1}
    borderColor="$borderColor"
    px="$4"
  >
    <Button
      intent="ghost"
      size="sm"
      icon={<ListFilter size={16} />}
      onPress={() => setSheetOpen(true)}
    >
      Lists
    </Button>
  </XStack>
</Hide>;
```

- [ ] **Step 6: Verify** — diagnostics clean; no remaining `isDesktop` references in the file.

### Task 9: `journal/new.tsx` — `Hide` for the mobile-only Back button

**Files:** Modify `apps/pwa/src/routes/_app/journal/new.tsx`

- [ ] **Step 1: Add `Hide` to the kit import (lines 8-18).** Replace:

```ts
import {
  Button,
  Calendar,
  Input,
  Popover,
  Text,
  ToggleGroup,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
```

with:

```ts
import {
  Button,
  Calendar,
  Hide,
  Input,
  Popover,
  Text,
  ToggleGroup,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
```

- [ ] **Step 2: Remove the hook import (line 20).** Delete `import { useMediaQuery } from "@/lib/hooks/use-media-query";`

- [ ] **Step 3: Remove the hook call (line 78).** Delete `  const isDesktop = useMediaQuery("(min-width: 768px)");`

- [ ] **Step 4: Wrap the Back button (lines 147-158).** Replace:

```tsx
{
  !isDesktop && (
    <View mb="$5">
      <Button
        intent="ghost"
        size="sm"
        icon={<ArrowLeft size={16} />}
        onPress={() => navigate({ to: "/journal" })}
      >
        Back
      </Button>
    </View>
  );
}
```

with:

```tsx
<Hide above="md">
  <View mb="$5">
    <Button
      intent="ghost"
      size="sm"
      icon={<ArrowLeft size={16} />}
      onPress={() => navigate({ to: "/journal" })}
    >
      Back
    </Button>
  </View>
</Hide>
```

- [ ] **Step 5: Verify** — diagnostics clean; no remaining `isDesktop` in the file.

### Task 10: `journal/$id.tsx` — `Hide` for the mobile-only Back button

**Files:** Modify `apps/pwa/src/routes/_app/journal/$id.tsx`

- [ ] **Step 1: Add `Hide` to the kit import (lines 8-20).** Replace:

```ts
import {
  AlertDialog,
  Button,
  IconButton,
  Input,
  Popover,
  Text,
  ToggleGroup,
  useToast,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
```

with:

```ts
import {
  AlertDialog,
  Button,
  Hide,
  IconButton,
  Input,
  Popover,
  Text,
  ToggleGroup,
  useToast,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
```

- [ ] **Step 2: Remove the hook import (line 22).** Delete `import { useMediaQuery } from "@/lib/hooks/use-media-query";`

- [ ] **Step 3: Remove the hook call (line 43).** Delete `  const isDesktop = useMediaQuery("(min-width: 768px)");`

- [ ] **Step 4: Wrap the Back button (lines 164-175).** Replace:

```tsx
{
  !isDesktop && (
    <View mb="$5">
      <Button
        intent="ghost"
        size="sm"
        icon={<ArrowLeft size={16} />}
        onPress={() => navigate({ to: "/journal" })}
      >
        Back
      </Button>
    </View>
  );
}
```

with:

```tsx
<Hide above="md">
  <View mb="$5">
    <Button
      intent="ghost"
      size="sm"
      icon={<ArrowLeft size={16} />}
      onPress={() => navigate({ to: "/journal" })}
    >
      Back
    </Button>
  </View>
</Hide>
```

- [ ] **Step 5: Verify** — diagnostics clean; no remaining `isDesktop` in the file.

### Task 11: Delete the now-unused `use-media-query.ts`

**Files:** Delete `apps/pwa/src/lib/hooks/use-media-query.ts`

- [ ] **Step 1: Confirm zero importers remain.** Run: `cd /Users/garda_dafi/Project/stageholder-meridian && grep -rn "use-media-query\|useMediaQuery" apps/pwa/src packages/features/src` — expect **no matches** after Tasks 6-10.
- [ ] **Step 2: Delete the file** only if Step 1 is empty: `rm apps/pwa/src/lib/hooks/use-media-query.ts`

---

## Phase 4 — Cleanups

### Task 12: Delete dead `theme-provider.tsx`

**Files:** Delete `apps/pwa/src/lib/theme-provider.tsx`

- [ ] **Step 1: Confirm it is imported nowhere.** Run: `cd /Users/garda_dafi/Project/stageholder-meridian && grep -rn "lib/theme-provider\|from \"@/lib/theme-provider\"" apps/pwa/src` — expect **no matches** (`App.tsx` inlines its own `<ThemeProvider>` from `next-themes`).
- [ ] **Step 2: Delete the file** only if Step 1 is empty: `rm apps/pwa/src/lib/theme-provider.tsx`

### Task 13: Celebration positioning under v5 — VERIFIED, no edit

- [ ] **Step 1: Confirm** the two absolute fill-overlays already have an explicit `position="relative"` parent in `@repo/features`:
  - `packages/features/src/habits/habit-card.tsx:253-254` — `<View position="relative" …>` wraps `{renderCompletionEffect?.(completing)}` (line 268).
  - `packages/features/src/journal/journal-editor.tsx:203` — `<YStack position="relative" flex={1} overflow="hidden">` wraps `{renderCelebration?.(celebrationTrigger)}` (line 204).
    No change required; recorded here so the verification is not re-done.

### Task 14 (OPTIONAL — defer to minimize churn): `animate-pulse` → kit `Skeleton`

> Stretch polish only. 16 `animate-pulse` className skeletons exist (heaviest: `apps/pwa/src/routes/_app/habits/index.tsx`, 12). The kit `Skeleton` (already imported elsewhere) renders the shimmer without a Tailwind className. **Do not do this unless explicitly requested** — it is cosmetic and adds diff noise.

- [ ] **Step 1 (if requested):** Read `apps/pwa/src/routes/_app/habits/index.tsx`, replace each `<… className="… animate-pulse …" />` loading block with `<Skeleton … />` matching the block's width/height, and add `Skeleton` to the `@stageholder/ui` import. Verify diagnostics.

---

## Phase 2 — PWA compiler/config alignment to the v2 guide (OPTIONAL, runtime-gated — do LAST)

> **Risk-bearing and verification-dependent.** The current `vite.config.ts`/`tamagui.build.ts` carry RC-era React-19 workarounds. Whether they can be removed depends on 2.0.0-stable's `@tamagui/react-native-web-lite` + static-worker behavior, which **only a real build confirms**. **Default: leave the config unchanged** (the workarounds are harmless if the underlying bug is fixed — they merely forgo the lite-bundle size win and config-file HMR). Only attempt the alignment below when you can run `bun run dev:pwa`/`build:pwa` and watch for the React-19 `unmountComponentAtNode` error.

### Task 15: (optional) Re-enable the Tamagui config watcher

**Files:** Modify `apps/pwa/tamagui.build.ts`, `apps/pwa/vite.config.ts`

- [ ] **Step 1:** In `apps/pwa/tamagui.build.ts`, remove the `disableWatchTamaguiConfig: true` line (and its comment block). In `apps/pwa/vite.config.ts`, remove `disableWatchTamaguiConfig: true` from the `tamaguiPlugin({...})` call.
- [ ] **Step 2 (user runs):** `bun run dev:pwa`, then edit a token in `tamagui.config.ts` and confirm HMR works WITHOUT a `unmountComponentAtNode` crash or static-worker error.
- [ ] **Step 3:** If it crashes, **revert** both removals (restore `disableWatchTamaguiConfig: true` in both files) and refresh the comment to cite 2.0.0 (not rc.42) as the version still exhibiting it. The workaround stays.

### Task 16: (optional) Adopt the guide-standard `tamaguiAliases`

> The guide (`tamagui-v2-guide/vite.md`) uses `tamaguiAliases({ rnwLite: true, svg: true })`. Note `rnwLite: true` **re-enables the lite package** — the opposite of the current manual alias, which routes lite → full `react-native-web` _because_ lite was React-19-broken in rc.42. Only adopt this if Step 2 proves 2.0.0 lite is React-19-safe.

**Files:** Modify `apps/pwa/vite.config.ts`

- [ ] **Step 1:** Add `tamaguiAliases` to the import (line 7): `import { tamaguiPlugin, tamaguiAliases } from "@tamagui/vite-plugin";`
- [ ] **Step 2 (decision):** Temporarily REMOVE the manual `@tamagui/react-native-web-lite → react-native-web` alias (vite.config.ts lines 128-131) and prepend `...tamaguiAliases({ rnwLite: true, svg: true }),` to the `alias: [` array. Keep ALL the `proxy-worm` native stubs and the `@/…` path aliases that follow.
- [ ] **Step 3 (user runs):** `bun run build:pwa` + `bun run dev:pwa`. Watch for `unmountComponentAtNode` / react-dom import errors.
- [ ] **Step 4:** If it errors, **revert** to the manual alias (restore lines 128-131, drop `tamaguiAliases`) and refresh the comment to reference 2.0.0. The manual alias stays as the grounded-but-necessary deviation, with the guide reference noted.

---

## Final gate

- [ ] **User runs:** `bun install` (if not already), `bun run dev:pwa` and/or `bun run build:pwa`.
- [ ] **User visual check** (web + a narrow ~375px window for responsive): journal master/detail + mobile Back button, todos sidebar↔drawer + Lists trigger, settings tabs (vertical pill on desktop ↔ horizontal underline on mobile), habit check-in radiance + journal target celebration, toasts. Confirm `Badge` styling (alpha.6 made `solid`/`outline` actually fill — see spec §6).

---

## Self-review (against the spec)

- **Spec §4 Phase 1** → Tasks 1-5. ✓ (root, pwa, features, mobile, install gate; `@tamagui/toast` added to pwa.)
- **Spec §4 Phase 2** → Tasks 15-16 (optional, gated, last). ✓
- **Spec §4 Phase 3** → Tasks 6-11 (5 consumers + hook deletion; exact `useMedia().md` / `Show`/`Hide` mapping). ✓
- **Spec §4 Phase 4** → Tasks 12-14 (dead-code delete, celebration verified-safe, optional Skeleton). ✓
- **Type/name consistency:** `useMedia`, `Show`, `Hide` are confirmed `@stageholder/ui` exports; `media.md` semantics confirmed in the kit's `responsive.tsx`. ✓
- **No placeholders:** every required step shows exact before/after. Task 14 is explicitly optional and Task 16's two outcomes both have exact code. ✓
