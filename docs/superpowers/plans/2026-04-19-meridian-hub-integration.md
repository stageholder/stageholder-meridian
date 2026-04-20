# Meridian ↔ Stageholder Hub Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Meridian's local auth with OIDC-based SSO from the Stageholder Hub, introduce a paid subscription tier, fix journal encryption recovery, and align data model around a single-user scope (no workspaces, no sharing).

**Architecture:** Meridian becomes an OIDC Relying Party. Web PWA uses the BFF pattern (iron-session cookie + server-held OIDC tokens). NestJS API verifies bearer tokens via `@stageholder/auth`. Tauri desktop uses PKCE with a loopback listener. All entities scoped by OIDC `sub`. Subscription limits read live from Hub via introspected `subscriptions` claim. Journal E2EE keeps the existing PBKDF2/AES-KW/AES-GCM primitives with a properly working recovery flow.

**Tech Stack:** NestJS 11, Next.js 15 (App Router), MongoDB (Mongoose), Dexie, Tauri v2 (Rust), Bun workspace monorepo via Turborepo, `@stageholder/auth` v0.1.0, `iron-session`, `@node-rs/argon2`, Polar (via Hub).

**Reference spec:** `docs/superpowers/specs/2026-04-19-meridian-hub-integration-design.md`

**Git convention:** The user handles all git operations themselves. This plan contains no `git add`/`git commit` steps — run "Verify" steps instead.

---

## Phase 0 — Prerequisites (Hub-side setup + package publish)

This phase is mostly Hub admin work and a one-time package publish. It must be complete before any Meridian code changes land.

### Task 0.1: Publish `@stageholder/auth` to GitHub Packages

**Files:**

- Modify: `~/Project/stageholder-identity/packages/auth/package.json`
- Create: `~/Project/stageholder-identity/.github/workflows/publish-auth.yml`

- [ ] **Step 1: Add publishConfig to `packages/auth/package.json`**

Edit the JSON to add these fields after `"types"`:

```json
"repository": {
  "type": "git",
  "url": "git+https://github.com/<ORG>/stageholder-identity.git",
  "directory": "packages/auth"
},
"publishConfig": {
  "registry": "https://npm.pkg.github.com",
  "access": "restricted"
},
"files": ["dist"]
```

Replace `<ORG>` with the actual GitHub org/user.

- [ ] **Step 2: Build the package locally**

Run: `cd ~/Project/stageholder-identity && bun install && bun --cwd packages/auth run build`
Expected: `packages/auth/dist/` populated with `index.js`, `index.d.ts`, etc.

- [ ] **Step 3: Create publish workflow**

File: `~/Project/stageholder-identity/.github/workflows/publish-auth.yml`

```yaml
name: Publish @stageholder/auth
on:
  push:
    tags: ["auth-v*"]
jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with: { bun-version: 1.2.12 }
      - run: bun install --frozen-lockfile
      - run: bun --cwd packages/auth run build
      - run: cd packages/auth && bun publish --access restricted
        env:
          NPM_CONFIG_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 4: Tag and push to trigger first publish**

Run (in Hub repo):

```
git tag auth-v0.1.0
git push origin auth-v0.1.0
```

Watch GitHub Actions tab. Expected: "Publish @stageholder/auth" workflow succeeds.

- [ ] **Step 5: Verify package is visible**

GitHub repo → "Packages" section → `@stageholder/auth` v0.1.0 (or current) listed.

---

### Task 0.2: Register OIDC clients in Hub admin

Manual admin work, no code. Done through Hub's superadmin UI at `https://id.stageholder.com/admin/oidc-clients`.

- [ ] **Step 1: Register `meridian-web`**

Form fields:

- Client ID: `meridian-web`
- Product Name: `Meridian (Web)`
- Application Type: `Web`
- Token Endpoint Auth Method: `client_secret_basic`
- Redirect URIs: `https://meridian.stageholder.com/auth/callback` and `http://localhost:4001/auth/callback`
- Post-Logout Redirect URIs: `https://meridian.stageholder.com/goodbye` and `http://localhost:4001/goodbye`
- Front-Channel Logout URI: `https://meridian.stageholder.com/auth/logout-notify` (and the localhost variant)
- Front-Channel Logout Session Required: `true`
- Grant Types: `authorization_code`, `refresh_token`
- Scopes: `openid`, `offline_access`, `profile`, `email`, `organizations`, `subscriptions`

**Save the generated `client_secret` to a password manager immediately.** It's shown only once.

- [ ] **Step 2: Register `meridian-desktop`**

Form fields:

- Client ID: `meridian-desktop`
- Application Type: `Native`
- Token Endpoint Auth Method: `none`
- Redirect URIs: `http://127.0.0.1:*/callback` (wildcard port — Hub must support this)
- Grant Types: `authorization_code`, `refresh_token`
- Scopes: same as web

- [ ] **Step 3: Register `meridian-mobile` (placeholder for future)**

Form fields:

- Client ID: `meridian-mobile`
- Application Type: `Native`
- Token Endpoint Auth Method: `none`
- Redirect URIs: `com.stageholder.meridian://callback`
- Grant Types: `authorization_code`, `refresh_token`
- Scopes: same as web

---

### Task 0.3: Seed Meridian product + plans + features in Hub DB

Done via Hub's admin UI at `/admin/products`, or via direct Drizzle migration if a UI doesn't exist.

- [ ] **Step 1: Create product `meridian`**

Via admin UI:

- Slug: `meridian`
- Display Name: `Meridian`
- Description: `Personal productivity: journals, habits, todos.`
- Status: `active`
- OIDC Client: link to `meridian-web`

- [ ] **Step 2: Create 3 product features**

| slug               | displayName   | valueType |
| ------------------ | ------------- | --------- |
| `max_habits`       | Active habits | number    |
| `max_todo_lists`   | Todo lists    | number    |
| `max_active_todos` | Active todos  | number    |

- [ ] **Step 3: Create 2 product plans**

Free plan:

- Slug: `meridian-free`
- Display Name: `Free`
- `isFreeTier: true`
- Polar product IDs: leave blank

Unlimited plan:

- Slug: `meridian-unlimited`
- Display Name: `Unlimited`
- `isFreeTier: false`
- Polar product IDs: filled in Task 0.4

- [ ] **Step 4: Set plan-feature matrix**

| plan × feature                          | value |
| --------------------------------------- | ----- |
| `meridian-free × max_habits`            | 5     |
| `meridian-free × max_todo_lists`        | 3     |
| `meridian-free × max_active_todos`      | 10    |
| `meridian-unlimited × max_habits`       | -1    |
| `meridian-unlimited × max_todo_lists`   | -1    |
| `meridian-unlimited × max_active_todos` | -1    |

- [ ] **Step 5: Verify by fetching claims**

Sign in as a test user to the Hub, check the decoded access token from `/oidc/token` — `subscriptions` claim should contain a row for Meridian Free.

---

### Task 0.4: Create Polar products for Unlimited plan

Manual work in the Polar dashboard.

- [ ] **Step 1: Create 4 Polar products**

In Polar dashboard → Products → New:

1. `Meridian Unlimited — Monthly (USD)` — recurring, monthly, USD price
2. `Meridian Unlimited — Yearly (USD)` — recurring, yearly, USD price
3. `Meridian Unlimited — Monthly (IDR)` — recurring, monthly, IDR price
4. `Meridian Unlimited — Yearly (IDR)` — recurring, yearly, IDR price

- [ ] **Step 2: Paste Polar product IDs into the Unlimited plan**

In Hub admin, edit `meridian-unlimited` plan, fill in:

- `polarProductIdMonthly`: USD-monthly product ID
- `polarProductIdYearly`: USD-yearly product ID

IDR variants go in custom fields if the Hub schema supports them, or create a second `meridian-unlimited-idr` plan (check current Hub schema capabilities first).

- [ ] **Step 3: Configure Polar webhook secret**

In Hub's Cloud Run env, ensure `POLAR_WEBHOOK_SECRET` matches the webhook endpoint registered at `https://id.stageholder.com/api/billing/webhooks`.

- [ ] **Step 4: Manual smoke check**

Visit `https://id.stageholder.com/pricing/meridian` — page should render with Free and Unlimited plan cards showing Polar prices.

---

### Task 0.5: Obtain a read-only GitHub Packages PAT for Meridian

- [ ] **Step 1: Generate a fine-grained PAT**

GitHub → Settings → Developer settings → Personal access tokens → Fine-grained → Generate new.

- Resource owner: the `<ORG>` owning `stageholder-identity`
- Expiration: 1 year
- Repository access: `stageholder-identity`
- Permissions: `Packages: Read`

- [ ] **Step 2: Save locally**

Store in `~/.zshrc` or similar:

```
export GITHUB_PACKAGES_TOKEN=<token>
```

- [ ] **Step 3: Plan for CI/prod**

Add the same token as a secret in Meridian's Cloud Run / GitHub Actions.

---

## Phase 1 — Meridian greenfield DB wipe + schema reset

Meridian is pre-production, so we're wiping the database and rebuilding the schema around `userSub`. Everything else in the plan assumes this has happened.

### Task 1.1: Drop the Meridian MongoDB database

- [ ] **Step 1: Connect to the Mongo instance**

Run: `mongosh "<MONGO_URI>"` where `MONGO_URI` comes from `apps/api/.env`.

- [ ] **Step 2: Drop the database**

Run inside `mongosh`:

```js
use meridian
db.dropDatabase()
```

- [ ] **Step 3: Verify**

Run: `show dbs`
Expected: `meridian` is absent (or 0 bytes if lazy).

---

### Task 1.2: Add `userSub` field to every domain Mongoose schema

**Files to modify** (exact names may differ slightly — grep first):

- `apps/api/src/modules/journal/journal.schema.ts`
- `apps/api/src/modules/habit/habit.schema.ts`
- `apps/api/src/modules/habit-entry/habit-entry.schema.ts`
- `apps/api/src/modules/todo-list/todo-list.schema.ts`
- `apps/api/src/modules/todo/todo.schema.ts`
- `apps/api/src/modules/tag/tag.schema.ts`
- `apps/api/src/modules/notification/notification.schema.ts`

- [ ] **Step 1: Map the existing schemas**

Run: `Grep pattern="workspaceId|ownerId|creatorId|assigneeId" type="ts" path="apps/api/src/modules"` — note every file that references these fields.

- [ ] **Step 2: For each schema file, apply the transform**

Example on `journal.schema.ts`:

```ts
// Before
@Prop({ type: String, required: true, index: true })
workspaceId: string;

@Prop({ type: String, required: true })
creatorId: string;

// After
@Prop({ type: String, required: true, index: true })
userSub: string;
```

Remove `creatorId`, `assigneeId`, `ownerId`, `workspaceId` entirely. Replace with one `userSub: string`.

- [ ] **Step 3: Add compound indexes per spec §4**

Example on `journal.schema.ts`:

```ts
JournalSchema.index({ userSub: 1, date: -1 });
JournalSchema.index({ userSub: 1, updatedAt: -1 });
```

Apply the index table from the spec to every schema.

- [ ] **Step 4: Verify build passes**

Run: `bun --cwd apps/api run build`
Expected: no TypeScript errors.

---

### Task 1.3: Update service methods to take and filter by `userSub`

**Files to modify:** all `*.service.ts` under `apps/api/src/modules/` for journal, habit, habit-entry, todo-list, todo, tag, notification.

- [ ] **Step 1: Add `userSub` as the first argument of every CRUD method**

Before:

```ts
async findAll(workspaceId: string): Promise<Journal[]> {
  return this.journalModel.find({ workspaceId });
}
```

After:

```ts
async findAll(userSub: string): Promise<Journal[]> {
  return this.journalModel.find({ userSub });
}
```

Apply this pattern to `findAll`, `findById`, `create`, `update`, `delete`, and any query methods. `findById` becomes:

```ts
async findById(userSub: string, id: string): Promise<Journal | null> {
  return this.journalModel.findOne({ _id: id, userSub });
}
```

**Critical:** every query MUST join `userSub`. No exceptions.

- [ ] **Step 2: Update controllers to pass `userSub` from request**

Example in `journal.controller.ts`:

```ts
@Get()
async list(@Req() req: StageholderRequest) {
  return this.journalService.findAll(req.user.sub);
}

@Get(':id')
async get(@Req() req: StageholderRequest, @Param('id') id: string) {
  const journal = await this.journalService.findById(req.user.sub, id);
  if (!journal) throw new NotFoundException();
  return journal;
}
```

`StageholderRequest` is imported from `@stageholder/auth` (added in Phase 2). For now, type it as `any` — Task 2.4 will fix the import.

- [ ] **Step 3: Verify build**

Run: `bun --cwd apps/api run build`
Expected: no TypeScript errors (may have `any` warnings — fine for now).

---

### Task 1.4: Remove workspace, workspace-member, invitation modules

**Files to delete:**

- `apps/api/src/modules/workspace/**`
- `apps/api/src/modules/workspace-member/**`
- `apps/api/src/modules/invitation/**` (workspace invitations)
- Any shared types under `packages/core/src/types/workspace.ts`

- [ ] **Step 1: Delete the directories**

Run:

```
rm -rf apps/api/src/modules/workspace apps/api/src/modules/workspace-member apps/api/src/modules/invitation
rm -f packages/core/src/types/workspace.ts
```

- [ ] **Step 2: Remove imports from `app.module.ts`**

Edit `apps/api/src/app.module.ts`. Remove any `WorkspaceModule`, `WorkspaceMemberModule`, `InvitationModule` from the imports array.

- [ ] **Step 3: Remove references from PWA types**

Run: `Grep pattern="workspace|Workspace" path="apps/pwa/src" type="ts"` — delete imports and types that reference the workspace concept.

- [ ] **Step 4: Verify build (will fail until Phase 2 clears `user`/`auth` module refs)**

Run: `bun run build`
Expected: errors in files that still reference workspace types. Note them; Phase 2 will clear most of them.

---

### Task 1.5: Rename `encryption-keys` module to `journal-security`

Structural rename to clarify intent before rewriting the internals in Phase 5.

**Files to move:**

- `apps/api/src/modules/encryption-keys/` → `apps/api/src/modules/journal-security/`

- [ ] **Step 1: Move the directory**

Run:

```
mv apps/api/src/modules/encryption-keys apps/api/src/modules/journal-security
```

- [ ] **Step 2: Rename files inside**

```
cd apps/api/src/modules/journal-security
mv encryption-keys.module.ts journal-security.module.ts
mv encryption-keys.service.ts journal-security.service.ts
mv encryption-keys.controller.ts journal-security.controller.ts
mv encryption-keys.dto.ts journal-security.dto.ts
```

- [ ] **Step 3: Update class names and route paths inside each file**

Rename `EncryptionKeysModule` → `JournalSecurityModule`, `EncryptionKeysService` → `JournalSecurityService`, etc. Change the controller's `@Controller('encryption-keys')` to `@Controller('journal-security')`.

- [ ] **Step 4: Update `app.module.ts`**

Replace `EncryptionKeysModule` import with `JournalSecurityModule`.

- [ ] **Step 5: Update PWA references**

In `apps/pwa/lib/crypto/encryption-store.ts`, change every `apiClient.get("/encryption-keys")` to `apiClient.get("/journal-security/keys")` (and similar for POST paths). Detailed endpoint rewrite is in Phase 5 — for now, match the renamed module's current endpoints.

---

## Phase 2 — API auth swap

Swap bcrypt/JWT for `@stageholder/auth`. This phase leaves the API broken at runtime (missing env vars, missing client secret) until Phase 3 sets things up. Build/typecheck should still pass.

### Task 2.1: Configure `.npmrc` and install `@stageholder/auth`

**Files:**

- Create: `apps/api/.npmrc`
- Create: `apps/pwa/.npmrc`
- Modify: `apps/api/package.json`, `apps/pwa/package.json`

- [ ] **Step 1: Create `.npmrc` in the monorepo root**

File: `/.npmrc` (at repo root):

```
@stageholder:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}
```

- [ ] **Step 2: Ensure the token env var is set in your shell**

Run: `echo $GITHUB_PACKAGES_TOKEN`
Expected: prints the PAT from Task 0.5. If empty, re-`source ~/.zshrc`.

- [ ] **Step 3: Install the package in API and PWA**

Run:

```
bun --cwd apps/api add @stageholder/auth
bun --cwd apps/pwa add @stageholder/auth
```

Expected: packages added, no auth errors in output.

---

### Task 2.2: Remove legacy auth dependencies from API

**Files:**

- Modify: `apps/api/package.json`

- [ ] **Step 1: Uninstall legacy auth deps**

Run:

```
bun --cwd apps/api remove bcryptjs @types/bcryptjs @nestjs/jwt @nestjs/passport passport passport-jwt passport-local passport-google-oauth20 @types/passport-jwt @types/passport-local jsonwebtoken @types/jsonwebtoken google-auth-library
```

Skip any package that's not already listed; `bun remove` is idempotent on missing deps.

- [ ] **Step 2: Verify `package.json`**

Run: `grep -E "bcrypt|jwt|passport|jsonwebtoken|google-auth" apps/api/package.json`
Expected: no matches (or only devDependencies left that are needed by other modules).

---

### Task 2.3: Wire `StageholderAuthModule` in `app.module.ts`

**Files:**

- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Import and register the module**

Replace the old `AuthModule` import and module-array entry with:

```ts
import { StageholderAuthModule } from '@stageholder/auth';
import { ConfigModule, ConfigService } from '@nestjs/config';

// In the @Module imports array:
StageholderAuthModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    issuerUrl: config.getOrThrow('IDENTITY_ISSUER_URL'),
    clientId: config.getOrThrow('IDENTITY_CLIENT_ID'),
    clientSecret: config.getOrThrow('IDENTITY_CLIENT_SECRET'),
  }),
}),
```

If `@stageholder/auth` doesn't expose `forRootAsync` (check its README), use `forRoot` with literal env reads.

- [ ] **Step 2: Apply guard globally**

Add to the providers array:

```ts
import { APP_GUARD } from '@nestjs/core';
import { StageholderAuthGuard } from '@stageholder/auth';

// In providers:
{ provide: APP_GUARD, useClass: StageholderAuthGuard },
```

- [ ] **Step 3: Add a `@Public()` health route escape hatch**

Create `apps/api/src/health/health.controller.ts`:

```ts
import { Controller, Get } from "@nestjs/common";
import { Public } from "@stageholder/auth"; // if SDK exposes it, else roll our own

@Controller("health")
export class HealthController {
  @Public()
  @Get()
  health() {
    return { status: "ok" };
  }
}
```

If `@stageholder/auth` doesn't export `Public`, create `apps/api/src/common/decorators/public.decorator.ts`:

```ts
import { SetMetadata } from "@nestjs/common";
export const IS_PUBLIC = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC, true);
```

And ensure the guard respects it (most SDKs do; verify in the SDK's README).

- [ ] **Step 4: Register `HealthModule` in `app.module.ts`**

Add `HealthController` to the controllers array or create a `HealthModule`.

- [ ] **Step 5: Verify build**

Run: `bun --cwd apps/api run build`
Expected: no TypeScript errors. App won't start yet (missing env vars) — that's fine.

---

### Task 2.4: Delete the legacy auth module

**Files to delete:**

- `apps/api/src/modules/auth/**`
- `apps/api/src/modules/user/**`
- `apps/api/src/common/guards/jwt-auth.guard.ts`
- `apps/api/src/common/decorators/current-user.decorator.ts` (the old one, if it exists)

- [ ] **Step 1: Delete directories**

Run:

```
rm -rf apps/api/src/modules/auth apps/api/src/modules/user
rm -f apps/api/src/common/guards/jwt-auth.guard.ts
```

- [ ] **Step 2: Remove references from `app.module.ts` and `main.ts`**

Edit each:

- Remove `AuthModule`, `UserModule`, `JwtAuthGuard` imports.
- Remove any `app.useGlobalGuards(new JwtAuthGuard(...))` call from `main.ts`.

- [ ] **Step 3: Replace `@CurrentUserId()` decorator usages**

Run: `Grep pattern="@CurrentUserId" type="ts" path="apps/api/src"`

For each usage, replace:

```ts
// Before
async list(@CurrentUserId() userId: string) {
  return this.journalService.findAll(userId);
}

// After
async list(@Req() req: StageholderRequest) {
  return this.journalService.findAll(req.user.sub);
}
```

Add the `StageholderRequest` type alias at the top of each controller file (or in a shared `apps/api/src/common/types.ts`):

```ts
import type { Request } from "express";
import type { StageholderUser } from "@stageholder/auth";

export interface StageholderRequest extends Request {
  user: StageholderUser;
}
```

- [ ] **Step 4: Verify build**

Run: `bun --cwd apps/api run build`
Expected: no errors. All references to the old user/auth modules are gone.

---

### Task 2.5: Update API env vars

**Files:**

- Modify: `apps/api/.env.example`, `apps/api/.env` (local)

- [ ] **Step 1: Remove legacy env vars**

Delete these lines from both files:

```
JWT_SECRET=...
REFRESH_TOKEN_EXPIRES_IN=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

- [ ] **Step 2: Add OIDC env vars**

Append to both files (values for local):

```
IDENTITY_ISSUER_URL=http://localhost:3000
IDENTITY_CLIENT_ID=meridian-web
IDENTITY_CLIENT_SECRET=<paste-from-Task-0.2-step-1>
```

- [ ] **Step 3: Start the API to smoke-check**

Run: `bun --cwd apps/api run dev`
Expected: "Nest application successfully started" on port 4000. Hitting `GET /health` returns `{"status":"ok"}`. Hitting any other endpoint without a Bearer token returns 401.

---

## Phase 3 — PWA BFF auth routes

Replace local login/register/callback with OIDC BFF flow.

### Task 3.1: Install iron-session and remove legacy auth deps in PWA

**Files:**

- Modify: `apps/pwa/package.json`

- [ ] **Step 1: Install**

Run: `bun --cwd apps/pwa add iron-session`

- [ ] **Step 2: Remove legacy deps**

Run:

```
bun --cwd apps/pwa remove zustand-middleware-auth
```

(Only if present; adjust based on what's in `package.json`.)

---

### Task 3.2: Create `lib/session.ts`

**Files:**

- Create: `apps/pwa/lib/session.ts`

- [ ] **Step 1: Write the session helpers**

```ts
// apps/pwa/lib/session.ts
import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";

export interface ProductSession {
  sub: string;
  email?: string;
  accessToken: string;
  refreshToken: string;
  idToken: string;
  accessTokenExpiresAt: number;
}

const COOKIE_NAME = "meridian_session";

const sessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: COOKIE_NAME,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  },
};

export async function getSession(): Promise<IronSession<ProductSession>> {
  const cookieStore = await cookies();
  return getIronSession<ProductSession>(cookieStore, sessionOptions);
}

export async function clearSession(): Promise<void> {
  const session = await getSession();
  session.destroy();
}
```

- [ ] **Step 2: Add SESSION_SECRET to env**

Generate: `openssl rand -hex 32`

Append to `apps/pwa/.env.local` and `apps/pwa/.env.example`:

```
SESSION_SECRET=<generated-hex>
IDENTITY_ISSUER_URL=http://localhost:3000
IDENTITY_CLIENT_ID=meridian-web
IDENTITY_CLIENT_SECRET=<paste-from-Task-0.2>
IDENTITY_REDIRECT_URI=http://localhost:4001/auth/callback
```

- [ ] **Step 3: Typecheck**

Run: `bun --cwd apps/pwa run build`
Expected: `session.ts` compiles.

---

### Task 3.3: Create `lib/oidc.ts` (PKCE + token helpers)

**Files:**

- Create: `apps/pwa/lib/oidc.ts`

- [ ] **Step 1: Write PKCE + refresh helpers**

```ts
// apps/pwa/lib/oidc.ts
import { randomBytes, createHash } from "crypto";
import type { ProductSession } from "./session";

const ISSUER = process.env.IDENTITY_ISSUER_URL!;
const CLIENT_ID = process.env.IDENTITY_CLIENT_ID!;
const CLIENT_SECRET = process.env.IDENTITY_CLIENT_SECRET!;
const REDIRECT_URI = process.env.IDENTITY_REDIRECT_URI!;

const SCOPES =
  "openid offline_access profile email organizations subscriptions";

function base64url(buf: Buffer) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function newPkce() {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  const state = base64url(randomBytes(32));
  return { verifier, challenge, state };
}

export function buildAuthorizeUrl({
  state,
  challenge,
}: {
  state: string;
  challenge: string;
}) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `${ISSUER}/oidc/auth?${params.toString()}`;
}

export async function exchangeCode(code: string, verifier: string) {
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${ISSUER}/oidc/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  });
  if (!res.ok)
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<{
    access_token: string;
    refresh_token: string;
    id_token: string;
    expires_in: number;
  }>;
}

export function decodeIdToken(idToken: string): {
  sub: string;
  email?: string;
} {
  const payload = idToken.split(".")[1];
  const decoded = Buffer.from(payload, "base64").toString("utf-8");
  return JSON.parse(decoded);
}

export async function refreshAccessToken(
  session: ProductSession,
): Promise<ProductSession> {
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${ISSUER}/oidc/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: session.refreshToken,
    }),
  });
  if (!res.ok) throw new Error("Refresh failed");
  const t = await res.json();
  return {
    ...session,
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    idToken: t.id_token ?? session.idToken,
    accessTokenExpiresAt: Math.floor(Date.now() / 1000) + t.expires_in,
  };
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  await fetch(`${ISSUER}/oidc/token/revocation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      token: refreshToken,
      token_type_hint: "refresh_token",
    }),
  }).catch(() => {}); // Best-effort
}
```

- [ ] **Step 2: Verify build**

Run: `bun --cwd apps/pwa run build`
Expected: no TypeScript errors.

---

### Task 3.4: Create `/auth/login` route (BFF redirect)

**Files:**

- Create: `apps/pwa/app/auth/login/route.ts`

- [ ] **Step 1: Write the route**

```ts
// apps/pwa/app/auth/login/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { newPkce, buildAuthorizeUrl } from "@/lib/oidc";

export async function GET() {
  const { verifier, challenge, state } = newPkce();
  const cookieStore = await cookies();
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
  };
  cookieStore.set("oauth_state", state, cookieOpts);
  cookieStore.set("oauth_pkce", verifier, cookieOpts);
  return NextResponse.redirect(buildAuthorizeUrl({ state, challenge }));
}
```

- [ ] **Step 2: Smoke-test**

Run Meridian PWA: `bun --cwd apps/pwa run dev` (on port 4001; set via `next.config.ts` or `--port 4001` flag).
Visit: `http://localhost:4001/auth/login`
Expected: browser redirects to `http://localhost:3000/oidc/auth?...` (Hub login page appears).

---

### Task 3.5: Create `/auth/callback` route

**Files:**

- Create: `apps/pwa/app/auth/callback/route.ts`

- [ ] **Step 1: Write the route**

```ts
// apps/pwa/app/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode, decodeIdToken } from "@/lib/oidc";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error)
    return NextResponse.redirect(
      new URL(`/auth/error?reason=${error}`, req.url),
    );
  if (!code || !state)
    return NextResponse.redirect(
      new URL("/auth/error?reason=missing_params", req.url),
    );

  const cookieStore = await cookies();
  const storedState = cookieStore.get("oauth_state")?.value;
  const verifier = cookieStore.get("oauth_pkce")?.value;

  if (!storedState || storedState !== state || !verifier) {
    return NextResponse.redirect(
      new URL("/auth/error?reason=state_mismatch", req.url),
    );
  }

  const tokens = await exchangeCode(code, verifier);
  const claims = decodeIdToken(tokens.id_token);

  const session = await getSession();
  session.sub = claims.sub;
  session.email = claims.email;
  session.accessToken = tokens.access_token;
  session.refreshToken = tokens.refresh_token;
  session.idToken = tokens.id_token;
  session.accessTokenExpiresAt =
    Math.floor(Date.now() / 1000) + tokens.expires_in;
  await session.save();

  cookieStore.delete("oauth_state");
  cookieStore.delete("oauth_pkce");

  return NextResponse.redirect(new URL("/app", req.url));
}
```

- [ ] **Step 2: Create a stub `/app` landing page if not already present**

File: `apps/pwa/app/app/page.tsx`:

```tsx
export default function AppLanding() {
  return <div>Welcome to Meridian</div>;
}
```

- [ ] **Step 3: End-to-end smoke-check**

Visit `http://localhost:4001/auth/login`, sign in on Hub with a test account, accept consent if prompted.
Expected: redirects back to `http://localhost:4001/app` showing the welcome page. Check browser DevTools: `meridian_session` cookie present, `oauth_state` + `oauth_pkce` cookies deleted.

---

### Task 3.6: Create `/auth/logout` route

**Files:**

- Create: `apps/pwa/app/auth/logout/route.ts`

- [ ] **Step 1: Write the route**

```ts
// apps/pwa/app/auth/logout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSession, clearSession } from "@/lib/session";
import { revokeRefreshToken } from "@/lib/oidc";

const ISSUER = process.env.IDENTITY_ISSUER_URL!;
const POST_LOGOUT_URI = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:4001"}/goodbye`;

export async function POST(req: NextRequest) {
  const session = await getSession();
  const idToken = session.idToken;
  const refreshToken = session.refreshToken;

  if (refreshToken) await revokeRefreshToken(refreshToken);
  await clearSession();

  if (!idToken) return NextResponse.redirect(POST_LOGOUT_URI);

  const params = new URLSearchParams({
    id_token_hint: idToken,
    post_logout_redirect_uri: POST_LOGOUT_URI,
  });
  return NextResponse.redirect(
    `${ISSUER}/oidc/session/end?${params.toString()}`,
  );
}
```

- [ ] **Step 2: Create `/goodbye` page**

File: `apps/pwa/app/goodbye/page.tsx`:

```tsx
export default function Goodbye() {
  return (
    <div>
      <h1>Signed out</h1>
      <a href="/auth/login">Sign in again</a>
    </div>
  );
}
```

- [ ] **Step 3: Smoke-check**

Trigger logout via a fetch: `fetch('/auth/logout', { method: 'POST' })`. Expected: redirect to Hub's `/oidc/session/end`, then back to `/goodbye`. `meridian_session` cookie cleared.

---

### Task 3.7: Create `/auth/logout-notify` (front-channel logout receiver)

**Files:**

- Create: `apps/pwa/app/auth/logout-notify/route.ts`

- [ ] **Step 1: Write the route**

```ts
// apps/pwa/app/auth/logout-notify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { clearSession } from "@/lib/session";

const ISSUER = process.env.IDENTITY_ISSUER_URL!;

export async function GET(req: NextRequest) {
  const iss = req.nextUrl.searchParams.get("iss");
  if (iss !== ISSUER) {
    return new NextResponse("invalid issuer", { status: 400 });
  }
  await clearSession();
  return new NextResponse("", { status: 200 });
}
```

- [ ] **Step 2: Verify build**

Run: `bun --cwd apps/pwa run build`
Expected: all 4 auth routes compile.

---

### Task 3.8: Delete old PWA auth routes and components

**Files to delete:**

- `apps/pwa/app/auth/login/page.tsx` (if was a page, not a route — check)
- `apps/pwa/app/auth/register/**`
- `apps/pwa/app/auth/forgot-password/**`
- `apps/pwa/app/auth/google/**`
- `apps/pwa/components/auth/auth-form-wrapper.tsx`
- `apps/pwa/lib/auth-helpers.ts`

- [ ] **Step 1: Map what exists**

Run: `Glob pattern="apps/pwa/app/auth/**" path="/Users/garda_dafi/Project/stageholder-meridian"`
Note every file. Keep only `login/route.ts`, `callback/route.ts`, `logout/route.ts`, `logout-notify/route.ts` created above.

- [ ] **Step 2: Delete the rest**

Run:

```
rm -rf apps/pwa/app/auth/register apps/pwa/app/auth/forgot-password apps/pwa/app/auth/google
rm -f apps/pwa/app/auth/login/page.tsx  # if it exists alongside route.ts
rm -rf apps/pwa/components/auth
rm -f apps/pwa/lib/auth-helpers.ts
```

- [ ] **Step 3: Remove Zustand auth-store usage, replace with session-backed hook**

Many components currently do `const user = useAuthStore((s) => s.user)`. Replace with a new hook that reads from the server session.

Create `apps/pwa/hooks/use-user.ts`:

```ts
"use client";
import { useQuery } from "@tanstack/react-query";

export interface MeridianUser {
  sub: string;
  email?: string;
  name?: string;
}

export function useUser() {
  return useQuery<MeridianUser | null>({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await fetch("/api/me", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 60_000,
  });
}
```

- [ ] **Step 4: Create `/api/me` BFF endpoint**

File: `apps/pwa/app/api/me/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session.sub) return new NextResponse(null, { status: 401 });
  return NextResponse.json({ sub: session.sub, email: session.email });
}
```

- [ ] **Step 5: Replace `useAuthStore` imports globally**

Run: `Grep pattern="useAuthStore" type="tsx,ts" path="apps/pwa"`
For each match, replace the import and usage to read from `useUser()` instead. Delete any `setUser`/`clearUser` calls — session management happens server-side now.

- [ ] **Step 6: Delete the auth store itself**

Run:

```
rm -f apps/pwa/stores/auth-store.ts packages/core/src/stores/auth-store.ts
```

- [ ] **Step 7: Verify build**

Run: `bun --cwd apps/pwa run build`
Expected: no TypeScript errors (may have UI errors around removed routes — fix by deleting dead components).

---

### Task 3.9: Update PWA middleware

**Files:**

- Modify: `apps/pwa/middleware.ts`

- [ ] **Step 1: Replace middleware to guard on `meridian_session` cookie**

```ts
// apps/pwa/middleware.ts
import { NextRequest, NextResponse } from "next/server";

const PROTECTED_PREFIXES = [
  "/app",
  "/journals",
  "/habits",
  "/todos",
  "/settings",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has("meridian_session");

  if (
    PROTECTED_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    ) &&
    !hasSession
  ) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/app/:path*",
    "/journals/:path*",
    "/habits/:path*",
    "/todos/:path*",
    "/settings/:path*",
  ],
};
```

- [ ] **Step 2: Smoke-check**

Visit `http://localhost:4001/app` without a session cookie.
Expected: redirect to `/auth/login`.

---

### Task 3.10: Update `lib/api-client.ts` to call Meridian API with session cookie

**Files:**

- Modify: `apps/pwa/lib/api-client.ts` (or wherever fetch wrapper lives)

- [ ] **Step 1: Switch client to call BFF proxy instead of Meridian API directly**

Create `apps/pwa/app/api/v1/[...path]/route.ts` — a proxy that forwards to Meridian API with the access token:

```ts
// apps/pwa/app/api/v1/[...path]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { refreshAccessToken } from "@/lib/oidc";

const API_URL = process.env.MERIDIAN_API_URL ?? "http://localhost:4000";

async function proxy(req: NextRequest, method: string, pathSegs: string[]) {
  const session = await getSession();
  if (!session.sub) return new NextResponse(null, { status: 401 });

  // Refresh if within 60s of expiry
  let current = session;
  if (session.accessTokenExpiresAt - 60 < Math.floor(Date.now() / 1000)) {
    const refreshed = await refreshAccessToken(session as any);
    session.accessToken = refreshed.accessToken;
    session.refreshToken = refreshed.refreshToken;
    session.idToken = refreshed.idToken;
    session.accessTokenExpiresAt = refreshed.accessTokenExpiresAt;
    await session.save();
    current = session;
  }

  const url = new URL(`${API_URL}/api/v1/${pathSegs.join("/")}`);
  req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));

  const headers = new Headers(req.headers);
  headers.set("Authorization", `Bearer ${current.accessToken}`);
  headers.delete("cookie");
  headers.delete("host");

  const body =
    method === "GET" || method === "DELETE" ? undefined : await req.text();
  const res = await fetch(url.toString(), { method, headers, body });
  return new NextResponse(res.body, {
    status: res.status,
    headers: res.headers,
  });
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  return proxy(req, "GET", path);
}
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  return proxy(req, "POST", path);
}
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  return proxy(req, "PATCH", path);
}
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  return proxy(req, "PUT", path);
}
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  return proxy(req, "DELETE", path);
}
```

- [ ] **Step 2: Point the client at the proxy**

Edit `apps/pwa/lib/api-client.ts`:

```ts
const BASE = "/api/v1"; // was process.env.NEXT_PUBLIC_API_URL; no longer needed
// All fetch() calls use relative URLs; browser includes meridian_session cookie;
// the Next.js proxy injects the Bearer token.
```

- [ ] **Step 3: Add `MERIDIAN_API_URL` to PWA env**

Append to `.env.local`:

```
MERIDIAN_API_URL=http://localhost:4000
```

- [ ] **Step 4: End-to-end smoke**

Sign in via `/auth/login`. Hit a journal/habit endpoint from the signed-in app. Expected: API request arrives at Meridian API with a valid Bearer token and is processed successfully.

---

## Phase 4 — Entitlement enforcement (API)

Gate writes to habits/todos/todo-lists against the free-tier limits.

### Task 4.1: Create `getPersonalOrgId` helper

**Files:**

- Create: `apps/api/src/common/helpers/personal-org.ts`

- [ ] **Step 1: Write the helper**

```ts
// apps/api/src/common/helpers/personal-org.ts
import type { StageholderUser } from "@stageholder/auth";

export function getPersonalOrgId(user: StageholderUser): string {
  const orgs = user.organizations ?? [];
  if (orgs.length === 0) {
    throw new Error(
      "User has no organizations; Hub should auto-provision a personal org.",
    );
  }
  // Personal org = first org (Hub auto-creates it on signup). Consider tagging
  // it with a `personal: true` flag in Hub claims if/when multi-org Meridian is added.
  return orgs[0].id;
}
```

- [ ] **Step 2: Verify compile**

Run: `bun --cwd apps/api run build`
Expected: clean.

---

### Task 4.2: Create `EntitlementInterceptor`

**Files:**

- Create: `apps/api/src/common/interceptors/entitlement.interceptor.ts`

- [ ] **Step 1: Write the interceptor**

```ts
// apps/api/src/common/interceptors/entitlement.interceptor.ts
import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { getFeatureLimit } from "@stageholder/auth";
import { Observable } from "rxjs";
import { getPersonalOrgId } from "../helpers/personal-org";

export const ENTITLEMENT_FEATURE_KEY = "entitlement:feature";

export interface EntitlementCheck {
  feature: "max_habits" | "max_todo_lists" | "max_active_todos";
  count: (req: any) => Promise<number>;
}

export const GateCreate =
  (check: EntitlementCheck) =>
  (target: any, key: string, desc: PropertyDescriptor) => {
    Reflect.defineMetadata(ENTITLEMENT_FEATURE_KEY, check, desc.value);
  };

@Injectable()
export class EntitlementInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  async intercept(
    ctx: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const handler = ctx.getHandler();
    const check = this.reflector.get<EntitlementCheck | undefined>(
      ENTITLEMENT_FEATURE_KEY,
      handler,
    );
    if (!check) return next.handle();

    const req = ctx.switchToHttp().getRequest();
    const orgId = getPersonalOrgId(req.user);
    const limit = getFeatureLimit(req.user, orgId, "meridian", check.feature);

    if (limit === -1 || limit === undefined) return next.handle();

    const current = await check.count(req);
    if (current >= limit) {
      throw new HttpException(
        {
          code: "limit_reached",
          feature: check.feature,
          limit,
          current,
          message: `You've reached your limit of ${limit}. Upgrade for unlimited.`,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
    return next.handle();
  }
}
```

- [ ] **Step 2: Register globally in `app.module.ts`**

```ts
import { APP_INTERCEPTOR } from '@nestjs/core';
import { EntitlementInterceptor } from './common/interceptors/entitlement.interceptor';

// providers:
{ provide: APP_INTERCEPTOR, useClass: EntitlementInterceptor },
```

- [ ] **Step 3: Verify build**

Run: `bun --cwd apps/api run build`

---

### Task 4.3: Apply `GateCreate` decorator to create endpoints

**Files to modify:**

- `apps/api/src/modules/habit/habit.controller.ts`
- `apps/api/src/modules/todo-list/todo-list.controller.ts`
- `apps/api/src/modules/todo/todo.controller.ts`

- [ ] **Step 1: Gate habit create**

Edit `habit.controller.ts`:

```ts
import { GateCreate } from '@/common/interceptors/entitlement.interceptor';

@Post()
@GateCreate({
  feature: 'max_habits',
  count: async (req) => habitService.countActiveForUser(req.user.sub),
})
async create(@Req() req: StageholderRequest, @Body() dto: CreateHabitDto) {
  return this.habitService.create(req.user.sub, dto);
}
```

This reads `habitService` from the controller's injected member. If the `count` callback runs before the service is injected, use an async resolver pattern — or simpler, do the count check inside the service itself and let the interceptor just be an "OR unlimited" short-circuit.

Alternative (cleaner): inline the limit check in the service and remove the interceptor indirection:

```ts
// habit.service.ts
async create(userSub: string, dto: CreateHabitDto, user: StageholderUser) {
  const orgId = getPersonalOrgId(user);
  const limit = getFeatureLimit(user, orgId, 'meridian', 'max_habits');
  if (limit !== -1 && limit !== undefined) {
    const current = await this.habitModel.countDocuments({ userSub, archived: { $ne: true } });
    if (current >= limit) {
      throw new HttpException(
        { code: 'limit_reached', feature: 'max_habits', limit, current },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
  }
  return this.habitModel.create({ userSub, ...dto });
}
```

**Choose one approach consistently** — the inline-in-service version is simpler and more testable. Use that. Delete the `GateCreate` decorator and `EntitlementInterceptor` if you pick this path, OR keep them if you want declarative gating.

Recommended: **inline in service**. Remove Task 4.2 interceptor if you go inline.

- [ ] **Step 2: Apply the same pattern to todo-list and todo**

`todo-list.service.ts` checks `max_todo_lists`:

```ts
const limit = getFeatureLimit(user, orgId, "meridian", "max_todo_lists");
if (limit !== -1 && limit !== undefined) {
  const current = await this.todoListModel.countDocuments({ userSub });
  if (current >= limit) {
    /* 402 */
  }
}
```

`todo.service.ts` checks `max_active_todos`:

```ts
const limit = getFeatureLimit(user, orgId, "meridian", "max_active_todos");
if (limit !== -1 && limit !== undefined) {
  const current = await this.todoModel.countDocuments({
    userSub,
    status: { $ne: "done" },
  });
  if (current >= limit) {
    /* 402 */
  }
}
```

- [ ] **Step 3: Pass `req.user` through from controller to service**

Each controller's create endpoint signature becomes:

```ts
@Post()
async create(@Req() req: StageholderRequest, @Body() dto: CreateHabitDto) {
  return this.habitService.create(req.user.sub, dto, req.user);
}
```

- [ ] **Step 4: Manual smoke**

Sign in as a test user on the free plan. Create 5 habits via `POST /api/v1/habits`. Expected: all succeed.
Create a 6th. Expected: 402 with `{ code: "limit_reached", feature: "max_habits", ... }`.

Upgrade the user to Unlimited in the Hub admin (manually set their subscription plan). Force a token refresh (wait 15 min or sign out/in). Create a 6th habit.
Expected: succeeds.

---

## Phase 5 — Journal security rewrite

Replace the broken recovery flow with a real one. Delete the plaintext-migration endpoint.

### Task 5.1: Add `@node-rs/argon2` to API

- [ ] **Step 1: Install**

Run: `bun --cwd apps/api add @node-rs/argon2`

---

### Task 5.2: Create the new `journal_security` Mongoose schema

**Files:**

- Create: `apps/api/src/modules/journal-security/journal-security.schema.ts`

- [ ] **Step 1: Write the schema**

```ts
// apps/api/src/modules/journal-security/journal-security.schema.ts
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type JournalSecurityDocument = HydratedDocument<JournalSecurity>;

@Schema({ collection: "journal_security", timestamps: true })
export class JournalSecurity {
  @Prop({ type: String, required: true })
  _id: string; // = userSub (OIDC sub UUID)

  @Prop({ required: true })
  encryptionEnabled: boolean;

  @Prop({ required: true })
  passphraseWrappedDek: string;

  @Prop({ required: true })
  passphraseSalt: string;

  @Prop({ required: true })
  recoveryWrappedDek: string;

  @Prop({ type: [String], required: true })
  recoveryCodeHashes: string[];

  @Prop({ required: true, default: 8 })
  recoveryCodesRemaining: number;
}

export const JournalSecuritySchema =
  SchemaFactory.createForClass(JournalSecurity);
```

- [ ] **Step 2: Register schema in the module**

Edit `journal-security.module.ts`:

```ts
MongooseModule.forFeature([{ name: JournalSecurity.name, schema: JournalSecuritySchema }]),
```

---

### Task 5.3: Rewrite `journal-security.service.ts`

**Files:**

- Rewrite: `apps/api/src/modules/journal-security/journal-security.service.ts`

- [ ] **Step 1: Write the complete service**

```ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as argon2 from "@node-rs/argon2";
import {
  JournalSecurity,
  JournalSecurityDocument,
} from "./journal-security.schema";

@Injectable()
export class JournalSecurityService {
  constructor(
    @InjectModel(JournalSecurity.name)
    private readonly model: Model<JournalSecurityDocument>,
  ) {}

  async getKeys(userSub: string) {
    const doc = await this.model.findById(userSub).lean();
    if (!doc) {
      return { wrappedDek: null, salt: null, encryptionEnabled: false };
    }
    return {
      wrappedDek: doc.passphraseWrappedDek,
      salt: doc.passphraseSalt,
      encryptionEnabled: doc.encryptionEnabled,
    };
  }

  async setup(
    userSub: string,
    dto: {
      passphraseWrappedDek: string;
      passphraseSalt: string;
      recoveryWrappedDek: string;
      recoveryCodes: string[]; // cleartext, hashed below
    },
  ) {
    const existing = await this.model.findById(userSub);
    if (existing?.encryptionEnabled)
      throw new ConflictException("Encryption already set up");
    if (dto.recoveryCodes.length !== 8)
      throw new BadRequestException("Must provide exactly 8 recovery codes");

    const hashes = await Promise.all(
      dto.recoveryCodes.map((code) =>
        argon2.hash(code, { memoryCost: 19456, timeCost: 2, parallelism: 1 }),
      ),
    );

    await this.model.findByIdAndUpdate(
      userSub,
      {
        _id: userSub,
        encryptionEnabled: true,
        passphraseWrappedDek: dto.passphraseWrappedDek,
        passphraseSalt: dto.passphraseSalt,
        recoveryWrappedDek: dto.recoveryWrappedDek,
        recoveryCodeHashes: hashes,
        recoveryCodesRemaining: 8,
      },
      { upsert: true, new: true },
    );
  }

  async changePassphrase(
    userSub: string,
    dto: {
      passphraseWrappedDek: string;
      passphraseSalt: string;
    },
  ) {
    const doc = await this.model.findById(userSub);
    if (!doc?.encryptionEnabled)
      throw new BadRequestException("Encryption is not set up");
    doc.passphraseWrappedDek = dto.passphraseWrappedDek;
    doc.passphraseSalt = dto.passphraseSalt;
    await doc.save();
  }

  async recover(
    userSub: string,
    submittedCodes: string[],
  ): Promise<{
    recoveryWrappedDek: string;
  }> {
    if (submittedCodes.length !== 8)
      throw new BadRequestException("Must provide 8 codes");
    const doc = await this.model.findById(userSub);
    if (!doc?.encryptionEnabled)
      throw new BadRequestException("Encryption is not set up");

    // Positional verify: each submitted[i] must match stored[i] (client must sort
    // before submission if it wants to, but order-dependent verification is simplest).
    // Reject if any hash fails; never short-circuit so timing leaks nothing.
    let allMatch = true;
    for (let i = 0; i < 8; i++) {
      const ok = await argon2.verify(
        doc.recoveryCodeHashes[i],
        submittedCodes[i],
      );
      if (!ok) allMatch = false;
    }
    if (!allMatch) throw new UnauthorizedException("Invalid recovery codes");

    doc.recoveryCodesRemaining = Math.max(0, doc.recoveryCodesRemaining - 1);
    await doc.save();

    return { recoveryWrappedDek: doc.recoveryWrappedDek };
  }

  async finalizeRecovery(
    userSub: string,
    dto: {
      passphraseWrappedDek: string;
      passphraseSalt: string;
      recoveryWrappedDek: string;
      recoveryCodes: string[];
    },
  ) {
    // After client unwraps using recovery, sets a new passphrase, and generates
    // fresh codes. Server re-hashes codes and overwrites.
    const doc = await this.model.findById(userSub);
    if (!doc) throw new NotFoundException();
    const hashes = await Promise.all(
      dto.recoveryCodes.map((code) =>
        argon2.hash(code, { memoryCost: 19456, timeCost: 2, parallelism: 1 }),
      ),
    );
    doc.passphraseWrappedDek = dto.passphraseWrappedDek;
    doc.passphraseSalt = dto.passphraseSalt;
    doc.recoveryWrappedDek = dto.recoveryWrappedDek;
    doc.recoveryCodeHashes = hashes;
    doc.recoveryCodesRemaining = 8;
    await doc.save();
  }
}
```

---

### Task 5.4: Rewrite `journal-security.controller.ts`

**Files:**

- Rewrite: `apps/api/src/modules/journal-security/journal-security.controller.ts`

- [ ] **Step 1: Write the controller**

```ts
import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import type { StageholderRequest } from "@/common/types";
import { JournalSecurityService } from "./journal-security.service";

@Controller("journal-security")
export class JournalSecurityController {
  constructor(private readonly service: JournalSecurityService) {}

  @Get("keys")
  async getKeys(@Req() req: StageholderRequest) {
    return this.service.getKeys(req.user.sub);
  }

  @Post("setup")
  async setup(
    @Req() req: StageholderRequest,
    @Body()
    body: {
      passphraseWrappedDek: string;
      passphraseSalt: string;
      recoveryWrappedDek: string;
      recoveryCodes: string[];
    },
  ) {
    await this.service.setup(req.user.sub, body);
    return { success: true };
  }

  @Put("passphrase")
  async changePassphrase(
    @Req() req: StageholderRequest,
    @Body() body: { passphraseWrappedDek: string; passphraseSalt: string },
  ) {
    await this.service.changePassphrase(req.user.sub, body);
    return { success: true };
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  @Post("recover")
  async recover(
    @Req() req: StageholderRequest,
    @Body() body: { codes: string[] },
  ) {
    return this.service.recover(req.user.sub, body.codes);
  }

  @Post("recover/finalize")
  async finalizeRecovery(
    @Req() req: StageholderRequest,
    @Body()
    body: {
      passphraseWrappedDek: string;
      passphraseSalt: string;
      recoveryWrappedDek: string;
      recoveryCodes: string[];
    },
  ) {
    await this.service.finalizeRecovery(req.user.sub, body);
    return { success: true };
  }
}
```

- [ ] **Step 2: Verify build**

Run: `bun --cwd apps/api run build`
Expected: clean.

---

### Task 5.5: Delete the plaintext `migrate-encryption` endpoint

- [ ] **Step 1: Grep for it**

Run: `Grep pattern="migrate-encryption" type="ts" path="apps/api"`

- [ ] **Step 2: Delete the controller method, service method, and any DTO**

Remove every matched line. If it was in the old `journal` module's controller, delete the method:

```ts
// DELETE THIS:
@Post(':id/journals/migrate-encryption')
async migrateEncryption(...) { ... }
```

Also delete the corresponding service method in `journal.service.ts`.

- [ ] **Step 3: Delete client-side migration helper**

```
rm -f apps/pwa/lib/crypto/migration.ts
```

Remove any import of `migrateExistingJournals` from the PWA.

- [ ] **Step 4: Verify build**

Run: `bun run build`

---

### Task 5.6: Rewrite client-side encryption store for new endpoints + recovery

**Files:**

- Rewrite: `apps/pwa/lib/crypto/encryption-store.ts`

- [ ] **Step 1: Update setup flow**

Replace `setupPassphrase` with code that also derives `recoveryWrappedDek`:

```ts
setupPassphrase: async (passphrase: string) => {
  const salt = generateSalt();
  const masterKey = await deriveMasterKey(passphrase, salt);
  const dek = await generateDEK();
  const passphraseWrappedDek = await wrapDEK(dek, masterKey);
  const passphraseSalt = saltToBase64(salt);

  const recoveryCodes = generateRecoveryCodes(); // 8 codes
  const recoveryMasterKey = await deriveRecoveryMasterKey(
    recoveryCodes,
    get().userSub,
  );
  const recoveryWrappedDek = await wrapDEK(dek, recoveryMasterKey);

  await apiClient.post("/journal-security/setup", {
    passphraseWrappedDek,
    passphraseSalt,
    recoveryWrappedDek,
    recoveryCodes,
  });

  set({
    dek,
    isUnlocked: true,
    isSetup: true,
    wrappedDek: passphraseWrappedDek,
    salt: passphraseSalt,
  });
  return recoveryCodes;
};
```

- [ ] **Step 2: Add `deriveRecoveryMasterKey` to `packages/crypto/src/keys.ts`**

```ts
// packages/crypto/src/keys.ts
export async function deriveRecoveryMasterKey(
  codes: string[],
  userSub: string,
): Promise<CryptoKey> {
  const sorted = [...codes].sort().join("");
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(sorted),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const salt = encoder.encode(userSub);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 600_000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-KW", length: 256 },
    false,
    ["wrapKey", "unwrapKey"],
  );
}
```

Export from `packages/crypto/src/index.ts`.

- [ ] **Step 3: Add recovery flow to encryption store**

```ts
recoverWithCodes: async (
  codes: string[],
  newPassphrase: string,
): Promise<string[]> => {
  const { userSub } = get();
  // 1. Server verifies codes + returns recoveryWrappedDek.
  const res = await apiClient.post("/journal-security/recover", { codes });
  const { recoveryWrappedDek } = res.data;

  // 2. Derive recovery key client-side, unwrap DEK.
  const recoveryKey = await deriveRecoveryMasterKey(codes, userSub);
  const dek = await unwrapDEK(recoveryWrappedDek, recoveryKey);

  // 3. Set new passphrase.
  const newSalt = generateSalt();
  const newMasterKey = await deriveMasterKey(newPassphrase, newSalt);
  const newPassphraseWrappedDek = await wrapDEK(dek, newMasterKey);

  // 4. Generate fresh recovery codes.
  const newCodes = generateRecoveryCodes();
  const newRecoveryKey = await deriveRecoveryMasterKey(newCodes, userSub);
  const newRecoveryWrappedDek = await wrapDEK(dek, newRecoveryKey);

  // 5. Finalize with server.
  await apiClient.post("/journal-security/recover/finalize", {
    passphraseWrappedDek: newPassphraseWrappedDek,
    passphraseSalt: saltToBase64(newSalt),
    recoveryWrappedDek: newRecoveryWrappedDek,
    recoveryCodes: newCodes,
  });

  set({
    dek,
    isUnlocked: true,
    wrappedDek: newPassphraseWrappedDek,
    salt: saltToBase64(newSalt),
  });
  return newCodes;
};
```

- [ ] **Step 4: Build the crypto package and PWA**

```
bun --cwd packages/crypto run build
bun --cwd apps/pwa run build
```

Expected: both clean.

- [ ] **Step 5: Manual smoke**

Sign in. Enable encryption with passphrase "test123!". Create a journal. Lock. Unlock with the same passphrase. Decryption succeeds.
Log out. Log back in. Don't type the passphrase — instead, click "Forgot passphrase." Enter the 8 recovery codes shown during setup. Set new passphrase "new456!". Decrypt the earlier journal with "new456!". Success.

---

## Phase 6 — Offline alignment

Dexie schema bump + mutation queue scoping + entitlement cache.

### Task 6.1: Bump Dexie schema

**Files:**

- Modify: `packages/offline/src/db/index.ts`

- [ ] **Step 1: Drop legacy stores, add userSub indexes**

Add a new version (current version is 4 — bump to 5):

```ts
// packages/offline/src/db/index.ts
this.version(5).stores({
  // Drop: workspaces, members, invitations
  workspaces: null,
  members: null,
  invitations: null,
  // Reindex by userSub
  todoLists: "id, userSub, isDefault",
  todos: "id, userSub, listId, status, [userSub+dueDate], [userSub+doDate]",
  journals: "id, userSub, date",
  habits: "id, userSub",
  habitEntries: "id, habitId, userSub, date, [habitId+date]",
  tags: "id, userSub",
  notifications: "id, userSub, read",
  // Mutation queue gains userSub
  pendingMutations: "++id, userSub, entityType, status, timestamp",
  // Sync meta keyed by (entityType, userSub)
  syncMeta: "[entityType+userSub]",
  // New caches
  entitlementCache: "userSub",
  journalSecurityCache: "userSub",
});
```

- [ ] **Step 2: Add types for the new caches**

```ts
export interface EntitlementCache {
  userSub: string;
  plan: 'meridian-free' | 'meridian-unlimited';
  entitled: boolean;
  limits: { max_habits: number; max_todo_lists: number; max_active_todos: number };
  updatedAt: number;
}

export interface JournalSecurityCache {
  userSub: string;
  passphraseWrappedDek: string;
  passphraseSalt: string;
  updatedAt: number;
}

// On the MeridianDB class:
entitlementCache!: Table<EntitlementCache, string>;
journalSecurityCache!: Table<JournalSecurityCache, string>;
```

- [ ] **Step 3: Verify build**

Run: `bun --cwd packages/offline run build`

---

### Task 6.2: Scope mutation queue by `userSub`

**Files:**

- Modify: `packages/offline/src/sync/mutation-queue.ts`, `packages/offline/src/sync/sync-manager.ts`

- [ ] **Step 1: Add `userSub` to `enqueue` signature**

```ts
// mutation-queue.ts
export async function enqueue(
  db: MeridianDB,
  userSub: string,
  mutation: Omit<
    PendingMutation,
    "id" | "userSub" | "status" | "retryCount" | "timestamp"
  >,
) {
  return db.pendingMutations.add({
    ...mutation,
    userSub,
    timestamp: Date.now(),
    status: "pending",
    retryCount: 0,
  });
}

export async function listPending(db: MeridianDB, userSub: string) {
  return db.pendingMutations.where({ userSub, status: "pending" }).toArray();
}

export async function clearForOtherSubs(db: MeridianDB, currentSub: string) {
  await db.pendingMutations.where("userSub").notEqual(currentSub).delete();
}
```

- [ ] **Step 2: Call `clearForOtherSubs` on session change**

In PWA's `useUser` hook or wherever session mounts (after session-change detection):

```ts
useEffect(() => {
  if (user?.sub) {
    clearForOtherSubs(db, user.sub).catch(console.error);
  }
}, [user?.sub]);
```

- [ ] **Step 3: Verify build**

---

### Task 6.3: Add entitlement cache refresh on sync

**Files:**

- Modify: `packages/offline/src/sync/sync-manager.ts`
- Create: `apps/pwa/lib/entitlement.ts`

- [ ] **Step 1: Create entitlement fetcher**

```ts
// apps/pwa/lib/entitlement.ts
import { db } from "@/lib/db"; // or wherever MeridianDB is exported

export async function refreshEntitlement(userSub: string) {
  const res = await fetch("/api/v1/me/entitlement", { credentials: "include" });
  if (!res.ok) return;
  const data = await res.json();
  await db.entitlementCache.put({
    userSub,
    plan: data.plan,
    entitled: data.entitled,
    limits: data.limits,
    updatedAt: Date.now(),
  });
}

export async function getCachedEntitlement(userSub: string) {
  return db.entitlementCache.get(userSub);
}
```

- [ ] **Step 2: Add Meridian API endpoint that returns the entitlement**

Create `apps/api/src/modules/me/me.controller.ts`:

```ts
import { Controller, Get, Req } from "@nestjs/common";
import { getFeatureLimit } from "@stageholder/auth";
import { getPersonalOrgId } from "@/common/helpers/personal-org";
import type { StageholderRequest } from "@/common/types";

@Controller("me")
export class MeController {
  @Get("entitlement")
  entitlement(@Req() req: StageholderRequest) {
    const orgId = getPersonalOrgId(req.user);
    const plan =
      req.user.subscriptions?.find(
        (s) => s.orgId === orgId && s.product === "meridian",
      )?.plan ?? "meridian-free";

    return {
      plan,
      entitled: true, // Binary entitlement is trivial since every plan is entitled.
      limits: {
        max_habits:
          getFeatureLimit(req.user, orgId, "meridian", "max_habits") ?? 5,
        max_todo_lists:
          getFeatureLimit(req.user, orgId, "meridian", "max_todo_lists") ?? 3,
        max_active_todos:
          getFeatureLimit(req.user, orgId, "meridian", "max_active_todos") ??
          10,
      },
    };
  }
}
```

Register in `app.module.ts` as `MeModule` or inline.

- [ ] **Step 3: Trigger refresh after each successful sync**

In `sync-manager.ts`, end of `fullSync`:

```ts
await refreshEntitlement(userSub);
```

- [ ] **Step 4: Verify build + smoke**

Sign in. Open DevTools → Application → IndexedDB → meridian → entitlementCache. After a sync, row for your `sub` appears with current plan and limits.

---

### Task 6.4: Cache journal-security blob offline

**Files:**

- Modify: `apps/pwa/lib/crypto/encryption-store.ts`

- [ ] **Step 1: On successful `checkStatus`, cache to Dexie**

```ts
checkStatus: async () => {
  set({ isLoading: true });
  try {
    const res = await apiClient.get("/journal-security/keys");
    const { wrappedDek, salt, encryptionEnabled } = res.data;
    set({ isSetup: encryptionEnabled, wrappedDek, salt });
    if (encryptionEnabled && wrappedDek && salt) {
      const { userSub } = get();
      await db.journalSecurityCache.put({
        userSub,
        passphraseWrappedDek: wrappedDek,
        passphraseSalt: salt,
        updatedAt: Date.now(),
      });
    }
  } catch {
    // Offline fallback: use cache
    const { userSub } = get();
    const cached = await db.journalSecurityCache.get(userSub);
    if (cached) {
      set({
        isSetup: true,
        wrappedDek: cached.passphraseWrappedDek,
        salt: cached.passphraseSalt,
      });
    } else {
      set({ isSetup: false });
    }
  } finally {
    set({ isLoading: false });
  }
};
```

- [ ] **Step 2: Smoke**

Sign in, unlock encryption. Go offline (DevTools → Network → Offline). Reload page. Re-enter passphrase. Expected: unlock succeeds against the cached blob.

---

## Phase 7 — PWA UI cleanup + outbound links to Hub

### Task 7.1: Delete workspace-related PWA routes

- [ ] **Step 1: Map and delete**

```
rm -rf apps/pwa/app/workspaces
rm -rf apps/pwa/app/workspace-select
rm -f apps/pwa/components/workspace-switcher.tsx
```

- [ ] **Step 2: Replace landing redirect**

In `apps/pwa/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function RootPage() {
  const has = (await cookies()).has("meridian_session");
  redirect(has ? "/app" : "/auth/login");
}
```

- [ ] **Step 3: Build + smoke**

Visit `http://localhost:4001/` signed out → redirects to `/auth/login`. Signed in → redirects to `/app`.

---

### Task 7.2: Add "Account Settings" and "Upgrade" links in PWA

**Files:**

- Modify: wherever the PWA has a user/nav menu (e.g., `apps/pwa/components/nav-user.tsx`)

- [ ] **Step 1: Add links**

```tsx
const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL!;  // https://id.stageholder.com

<a href={`${HUB_URL}/account/profile`} target="_blank" rel="noopener">
  Account Settings
</a>
<a href={`${HUB_URL}/pricing/meridian`} target="_blank" rel="noopener">
  Upgrade to Unlimited
</a>
<a href={`${HUB_URL}/account/[personalOrgSlug]/billing`.replace('[personalOrgSlug]', personalOrgSlug)} target="_blank" rel="noopener">
  Manage subscription
</a>
```

- [ ] **Step 2: Expose `personalOrgSlug` via `/api/me`**

Update `apps/pwa/app/api/me/route.ts` to decode the ID token server-side and return the slug:

```ts
// apps/pwa/app/api/me/route.ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

interface IdTokenClaims {
  sub: string;
  email?: string;
  name?: string;
  organizations?: { id: string; slug: string; name: string; role: string }[];
}

function decodeIdToken(idToken: string): IdTokenClaims {
  const payload = idToken.split(".")[1];
  return JSON.parse(Buffer.from(payload, "base64").toString("utf-8"));
}

export async function GET() {
  const session = await getSession();
  if (!session.sub || !session.idToken)
    return new NextResponse(null, { status: 401 });
  const claims = decodeIdToken(session.idToken);
  const personalOrg = claims.organizations?.[0];
  return NextResponse.json({
    sub: claims.sub,
    email: claims.email,
    name: claims.name,
    personalOrgSlug: personalOrg?.slug ?? null,
    personalOrgId: personalOrg?.id ?? null,
  });
}
```

The `useUser()` hook from Task 3.8 already fetches this endpoint; just extend its return type to include the new fields.

- [ ] **Step 3: Add `NEXT_PUBLIC_HUB_URL` to env**

Append to `apps/pwa/.env.local`:

```
NEXT_PUBLIC_HUB_URL=http://localhost:3001
```

---

### Task 7.3: Paywall modal component

**Files:**

- Create: `apps/pwa/components/paywall-modal.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL!;

interface PaywallModalProps {
  open: boolean;
  onClose: () => void;
  feature: string;
  limit: number;
}

export function PaywallModal({
  open,
  onClose,
  feature,
  limit,
}: PaywallModalProps) {
  const readable =
    feature === "max_habits"
      ? "habits"
      : feature === "max_todo_lists"
        ? "todo lists"
        : "active todos";
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>You've reached your limit</DialogTitle>
          <DialogDescription>
            Free users can have up to {limit} {readable}. Upgrade to Unlimited
            for unlimited {readable}, plus every future feature.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Maybe later
          </Button>
          <a
            href={`${HUB_URL}/pricing/meridian`}
            target="_blank"
            rel="noopener"
          >
            <Button>Upgrade to Unlimited</Button>
          </a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Hook into the API client**

In `apps/pwa/lib/api-client.ts`, when a 402 response comes back, parse and show the paywall:

```ts
if (res.status === 402) {
  const body = await res.json();
  // Dispatch a custom event or use a global store (Zustand) to open the paywall
  window.dispatchEvent(new CustomEvent("meridian:paywall", { detail: body }));
  throw new ApiError(402, body.message, body.code);
}
```

Listen for the event in a top-level layout and show the modal. Implementation sketch in `apps/pwa/components/paywall-listener.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { PaywallModal } from "./paywall-modal";

export function PaywallListener() {
  const [state, setState] = useState<{
    open: boolean;
    feature: string;
    limit: number;
  }>({ open: false, feature: "", limit: 0 });
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setState({ open: true, feature: detail.feature, limit: detail.limit });
    };
    window.addEventListener("meridian:paywall", handler);
    return () => window.removeEventListener("meridian:paywall", handler);
  }, []);
  return (
    <PaywallModal
      {...state}
      onClose={() => setState((s) => ({ ...s, open: false }))}
    />
  );
}
```

Mount `<PaywallListener />` in `apps/pwa/app/layout.tsx`.

- [ ] **Step 3: Smoke**

As a free-plan user, create 6 habits (via UI). After the 5th, the 6th attempt surfaces the paywall modal.

---

## Phase 8 — Tauri desktop PKCE native flow

This phase can be deferred if you want to ship web first. Full desktop support requires Rust changes.

### Task 8.1: Add `tauri-plugin-stronghold`

**Files:**

- Modify: `apps/desktop/src-tauri/Cargo.toml`, `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Add dependency**

Edit `apps/desktop/src-tauri/Cargo.toml`:

```toml
[dependencies]
tauri-plugin-stronghold = "2"
```

- [ ] **Step 2: Register plugin**

In `apps/desktop/src-tauri/src/lib.rs`:

```rust
.plugin(tauri_plugin_stronghold::Builder::new(|password| {
    // Hash the user-provided password to derive the Stronghold vault key.
    // For minimal setup, use a static pepper + the password:
    use argon2::{Argon2, password_hash::SaltString};
    let salt = SaltString::encode_b64(b"meridian-stronghold").unwrap();
    let argon2 = Argon2::default();
    let mut key = [0u8; 32];
    argon2.hash_password_into(password.as_bytes(), salt.as_str().as_bytes(), &mut key).unwrap();
    key.to_vec()
}).build())
```

(Add `argon2` to Cargo.toml if not already.)

- [ ] **Step 3: Verify**

Run: `bun --cwd apps/desktop run tauri dev`
Expected: app starts, no plugin registration errors.

---

### Task 8.2: Rust loopback listener command

**Files:**

- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Add a command to bind an ephemeral port**

```rust
use std::net::TcpListener;

#[tauri::command]
async fn start_oauth_listener() -> Result<(u16, String), String> {
  let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
  let port = listener.local_addr().map_err(|e| e.to_string())?.port();

  let (tx, rx) = tokio::sync::oneshot::channel();
  tokio::task::spawn_blocking(move || {
    if let Ok((mut stream, _)) = listener.accept() {
      use std::io::{Read, Write};
      let mut buf = [0u8; 8192];
      let n = stream.read(&mut buf).unwrap_or(0);
      let req = String::from_utf8_lossy(&buf[..n]);
      // Parse "GET /callback?code=...&state=... HTTP/1.1"
      let first = req.lines().next().unwrap_or("");
      let query = first.split(' ').nth(1).unwrap_or("").to_string();
      let _ = stream.write_all(b"HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n<html><body>You can close this tab.</body></html>");
      let _ = tx.send(query);
    }
  });

  let query = rx.await.map_err(|e| e.to_string())?;
  Ok((port, query))
}
```

Register in `.invoke_handler(generate_handler![start_oauth_listener])`.

---

### Task 8.3: TypeScript-side Tauri OIDC flow

**Files:**

- Create: `apps/desktop/src/lib/oidc-tauri.ts`

- [ ] **Step 1: Write the flow**

```ts
// apps/desktop/src/lib/oidc-tauri.ts
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";
import { Stronghold } from "@tauri-apps/plugin-stronghold";

const ISSUER = import.meta.env.VITE_IDENTITY_ISSUER_URL!;
const CLIENT_ID = "meridian-desktop";
const SCOPES =
  "openid offline_access profile email organizations subscriptions";

function base64url(buf: Uint8Array) {
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sha256(s: string) {
  const data = new TextEncoder().encode(s);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", data));
}

export async function signIn(
  passphrase: string,
): Promise<{ accessToken: string; idToken: string; sub: string }> {
  const [port, _query] = await invoke<[number, string]>("start_oauth_listener");
  const redirectUri = `http://127.0.0.1:${port}/callback`;

  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(await sha256(verifier));
  const state = base64url(crypto.getRandomValues(new Uint8Array(32)));

  const authUrl = `${ISSUER}/oidc/auth?${new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString()}`;
  await open(authUrl);

  // Wait for callback via second invoke (listener already waiting)
  const [, queryString] = await invoke<[number, string]>(
    "start_oauth_listener",
  );
  const params = new URLSearchParams(queryString.split("?")[1] ?? "");
  if (params.get("state") !== state) throw new Error("State mismatch");
  const code = params.get("code");
  if (!code) throw new Error("No code");

  const tokenRes = await fetch(`${ISSUER}/oidc/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: CLIENT_ID,
      code_verifier: verifier,
    }),
  });
  if (!tokenRes.ok) throw new Error("Token exchange failed");
  const t = await tokenRes.json();

  // Store refresh token in Stronghold
  const stronghold = await Stronghold.load("./vault.hold", passphrase);
  const client = await stronghold
    .loadClient("meridian")
    .catch(() => stronghold.createClient("meridian"));
  const store = client.getStore();
  await store.insert(
    "refresh_token",
    Array.from(new TextEncoder().encode(t.refresh_token)),
  );
  await stronghold.save();

  const claims = JSON.parse(atob(t.id_token.split(".")[1]));
  return { accessToken: t.access_token, idToken: t.id_token, sub: claims.sub };
}
```

- [ ] **Step 2: Wire into Tauri shell app entry**

Replace the web shell's sign-in with this function when running in Tauri context. Detect via `import.meta.env.TAURI_PLATFORM` or similar.

---

## Phase 9 — Hub polling endpoint + Meridian cleanup handler

Single Hub-side addition: a cursor-based events endpoint so Meridian can react to account deletion.

### Task 9.1: Add `events` table + emitter to Hub

**Files (Hub repo):**

- Modify: `~/Project/stageholder-identity/apps/api/src/database/schema.ts`
- Create: `~/Project/stageholder-identity/apps/api/src/events/events.service.ts`

- [ ] **Step 1: Add the table**

In Hub schema.ts:

```ts
export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: varchar("type", { length: 100 }).notNull(),
    product: varchar("product", { length: 100 }),
    userSub: uuid("user_sub"),
    orgId: uuid("org_id"),
    payload: jsonb("payload"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    idxProductOccurred: index("events_product_occurred").on(
      t.product,
      t.occurredAt,
    ),
  }),
);
```

- [ ] **Step 2: Run Drizzle migration**

```
cd ~/Project/stageholder-identity
bun run db:generate
bun run db:migrate
```

- [ ] **Step 3: Create `EventsService`**

```ts
// apps/api/src/events/events.service.ts
import { Injectable } from "@nestjs/common";
import { db } from "../database";
import { events } from "../database/schema";
import { and, gt, eq, sql } from "drizzle-orm";

@Injectable()
export class EventsService {
  async emit(params: {
    type: string;
    product?: string;
    userSub?: string;
    orgId?: string;
    payload?: any;
  }) {
    await db.insert(events).values(params);
  }

  async list({
    product,
    cursor,
    limit,
  }: {
    product: string;
    cursor?: string;
    limit: number;
  }) {
    const whereClauses = [eq(events.product, product)];
    if (cursor) whereClauses.push(gt(events.occurredAt, new Date(cursor)));
    const rows = await db
      .select()
      .from(events)
      .where(and(...whereClauses))
      .orderBy(events.occurredAt)
      .limit(limit);
    const nextCursor =
      rows.length > 0 ? rows[rows.length - 1].occurredAt.toISOString() : cursor;
    return { events: rows, nextCursor };
  }
}
```

---

### Task 9.2: Add `GET /api/events` endpoint

**Files:**

- Create: `~/Project/stageholder-identity/apps/api/src/events/events.controller.ts`

- [ ] **Step 1: Write the controller**

```ts
// Hub events controller
import {
  Controller,
  Get,
  Query,
  UseGuards,
  Headers,
  UnauthorizedException,
} from "@nestjs/common";
import { EventsService } from "./events.service";
import { db } from "../database";
import { oidcClients } from "../database/schema";
import { eq } from "drizzle-orm";

@Controller("api/events")
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  async list(
    @Headers("authorization") auth: string,
    @Query("product") product: string,
    @Query("since") since: string | undefined,
    @Query("limit") limit = "100",
  ) {
    // Client credentials: Basic base64(client_id:client_secret)
    if (!auth?.startsWith("Basic ")) throw new UnauthorizedException();
    const decoded = Buffer.from(auth.slice(6), "base64").toString();
    const [clientId, clientSecret] = decoded.split(":");
    const [client] = await db
      .select()
      .from(oidcClients)
      .where(eq(oidcClients.clientId, clientId));
    if (!client || client.clientSecret !== clientSecret)
      throw new UnauthorizedException();
    return this.events.list({
      product,
      cursor: since,
      limit: Math.min(parseInt(limit), 500),
    });
  }
}
```

Register module, add to `app.module.ts`.

---

### Task 9.3: Emit `user.deleted` in Hub

**Files:**

- Modify: `~/Project/stageholder-identity/apps/api/src/account/account.controller.ts`

- [ ] **Step 1: Inject `EventsService` and emit on delete**

Add to the `deleteAccount` method, right before `await this.usersService.deleteUser(req.userId)`:

```ts
// For each product the user is known to touch, emit an event.
// Simplest: emit one event with no product; each product polls for its slug and gets it.
// OR: enumerate every product that has data linked to this user via product_access.
// We'll do the latter for correctness.

const productAccess = await this.productAccessService.findByUser(req.userId);
const products = new Set(productAccess.map((p) => p.product));
for (const product of products) {
  await this.eventsService.emit({
    type: "user.deleted",
    product,
    userSub: req.userId,
  });
}
```

- [ ] **Step 2: Verify**

Delete a test user in Hub. Query the `events` table:

```
SELECT * FROM events WHERE type = 'user.deleted';
```

Row present with the deleted user's sub.

---

### Task 9.4: Meridian `hub_events_cursor` + polling cron

**Files (Meridian repo):**

- Create: `apps/api/src/modules/hub-events/hub-events.schema.ts`
- Create: `apps/api/src/modules/hub-events/hub-events.service.ts`
- Create: `apps/api/src/modules/hub-events/hub-events.module.ts`

- [ ] **Step 1: Cursor schema**

```ts
// hub-events.schema.ts
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

@Schema({ collection: "hub_events_cursor" })
export class HubEventsCursor {
  @Prop({ type: String, required: true })
  _id: string; // = 'meridian'

  @Prop({ required: true })
  cursor: string | null;
}
export const HubEventsCursorSchema =
  SchemaFactory.createForClass(HubEventsCursor);
```

- [ ] **Step 2: Polling service**

```ts
// hub-events.service.ts
import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { HubEventsCursor } from "./hub-events.schema";
// ... import all domain services to cascade-delete

@Injectable()
export class HubEventsService {
  private readonly logger = new Logger(HubEventsService.name);

  constructor(
    @InjectModel(HubEventsCursor.name)
    private readonly cursorModel: Model<HubEventsCursor>,
    // inject services to cascade: journal, habit, etc.
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async poll() {
    const row = await this.cursorModel.findById("meridian").lean();
    const since = row?.cursor ?? undefined;

    const url = new URL(`${process.env.IDENTITY_ISSUER_URL}/api/events`);
    url.searchParams.set("product", "meridian");
    if (since) url.searchParams.set("since", since);
    url.searchParams.set("limit", "100");

    const basic = Buffer.from(
      `${process.env.IDENTITY_CLIENT_ID}:${process.env.IDENTITY_CLIENT_SECRET}`,
    ).toString("base64");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Basic ${basic}` },
    });
    if (!res.ok) {
      this.logger.warn(`Poll failed: ${res.status}`);
      return;
    }
    const { events, nextCursor } = await res.json();
    for (const ev of events) {
      await this.handle(ev);
    }
    if (nextCursor) {
      await this.cursorModel.findByIdAndUpdate(
        "meridian",
        { cursor: nextCursor },
        { upsert: true },
      );
    }
  }

  private async handle(ev: { type: string; userSub: string; payload?: any }) {
    if (ev.type !== "user.deleted") return;
    const userSub = ev.userSub;
    // Cascade delete across all Meridian collections
    await Promise.all([
      this.journalModel.deleteMany({ userSub }),
      this.habitModel.deleteMany({ userSub }),
      this.habitEntryModel.deleteMany({ userSub }),
      this.todoListModel.deleteMany({ userSub }),
      this.todoModel.deleteMany({ userSub }),
      this.tagModel.deleteMany({ userSub }),
      this.notificationModel.deleteMany({ userSub }),
      this.journalSecurityModel.deleteOne({ _id: userSub }),
    ]);
    this.logger.log(`Cascade-deleted Meridian data for sub=${userSub}`);
  }
}
```

- [ ] **Step 3: Wire module**

Register `HubEventsModule` in `app.module.ts`. Install `@nestjs/schedule`:

```
bun --cwd apps/api add @nestjs/schedule
```

In `app.module.ts`:

```ts
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [ScheduleModule.forRoot(), ..., HubEventsModule],
})
```

- [ ] **Step 4: Manual smoke**

Delete a test user in Hub. Wait 5 min (or invoke the cron manually by calling `service.poll()`). Expected: Meridian logs "Cascade-deleted Meridian data for sub=...". All collections in Meridian for that sub are empty.

---

## Phase 10 — Manual verification

These are the ten checkpoints from §8 of the spec. Walk through each one yourself with a fresh test user and a clean database.

- [ ] **1. Sign-up → encrypt → view**: Sign up via Hub. Land in Meridian. Set encryption passphrase. Create a journal. Lock encryption. Unlock with same passphrase. Journal decrypts.
- [ ] **2. Free-tier paywall on limit**: Create 5 habits. Create a 6th → paywall modal appears.
- [ ] **3. Upgrade + limit lifted**: Upgrade to Unlimited via Hub pricing page. Return to Meridian. Sign out and back in (force fresh token). Create a 6th habit → succeeds.
- [ ] **4. Cancel → next write paywalled**: Cancel subscription in Hub (or simulate by editing subscription row to `status: canceled, currentPeriodEnd: past`). Attempt a write → 402 → paywall.
- [ ] **5. Cross-tab logout**: Sign in in two tabs. Sign out in tab A. Tab B's next API call surfaces 401 → redirect to login (front-channel logout clears session in both).
- [ ] **6. Recovery flow**: Write a journal. Forget passphrase (don't type it). Enter the 8 recovery codes from setup. Set a new passphrase. Decrypt the earlier journal → success.
- [ ] **7. Offline-create sync**: Go offline. Create 2 journals. Go online. Sync succeeds; journals persist server-side as ciphertext.
- [ ] **8. Account deletion cascade**: Delete account in Hub. Wait 5 min. Query Meridian Mongo directly for that sub → no documents remain.
- [ ] **9. Fresh Tauri install**: Install Tauri app on a clean machine. Open → PKCE loopback sign-in → app loads with synced data.
- [ ] **10. Wrong passphrase**: At unlock prompt, enter wrong passphrase → clear error, no lockout, no data damage.

If all 10 pass, the integration is complete.

---

## Deferred items (outside this plan)

- Mobile app (iOS/Android) — OIDC clients registered but no client code in this plan.
- Upgrading Hub events from polling to true outbound webhooks — add later when product count justifies it.
- Exact USD/IDR price numbers — set directly in Polar dashboard; no code change needed.
- Audit log dashboards for Meridian domain events — table exists (if you keep it), UI deferred.

---

## Appendix: File-structure summary

**Created on Meridian side:**

```
apps/api/src/
  common/helpers/personal-org.ts
  common/types.ts                                  # StageholderRequest type
  health/health.controller.ts
  me/me.controller.ts
  modules/journal-security/*.ts                    # renamed + rewritten
  modules/hub-events/*.ts                          # new polling

apps/pwa/
  .npmrc
  lib/session.ts
  lib/oidc.ts
  lib/entitlement.ts
  hooks/use-user.ts
  app/auth/login/route.ts
  app/auth/callback/route.ts
  app/auth/logout/route.ts
  app/auth/logout-notify/route.ts
  app/api/me/route.ts
  app/api/v1/[...path]/route.ts                    # BFF proxy
  app/goodbye/page.tsx
  components/paywall-modal.tsx
  components/paywall-listener.tsx

apps/desktop/
  src-tauri/Cargo.toml                             # + tauri-plugin-stronghold
  src-tauri/src/lib.rs                             # start_oauth_listener command
  src/lib/oidc-tauri.ts

packages/crypto/src/keys.ts                        # + deriveRecoveryMasterKey
packages/offline/src/db/index.ts                   # schema version 5
packages/offline/src/sync/mutation-queue.ts        # userSub-scoped

/.npmrc                                            # GitHub Packages
```

**Deleted on Meridian side:**

```
apps/api/src/modules/auth/**
apps/api/src/modules/user/**
apps/api/src/modules/workspace/**
apps/api/src/modules/workspace-member/**
apps/api/src/modules/invitation/**
apps/api/src/common/guards/jwt-auth.guard.ts
apps/api/src/common/decorators/current-user.decorator.ts
apps/pwa/app/auth/register/**
apps/pwa/app/auth/forgot-password/**
apps/pwa/app/auth/google/**
apps/pwa/app/workspaces/**
apps/pwa/app/workspace-select/**
apps/pwa/stores/auth-store.ts
apps/pwa/lib/auth-helpers.ts
apps/pwa/lib/crypto/migration.ts
apps/pwa/components/auth/**
packages/core/src/stores/auth-store.ts
packages/core/src/types/workspace.ts
```

**Created on Hub side (new, small):**

```
apps/api/src/events/events.service.ts
apps/api/src/events/events.controller.ts
apps/api/src/events/events.module.ts
apps/api/src/database/schema.ts                    # + events table
.github/workflows/publish-auth.yml
packages/auth/package.json                         # + publishConfig
```
