# Onboarding Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route first-time Meridian users to `/onboarding` after sign-in, persist their timezone on completion, and never bounce returning users through the flow again.

**Architecture:** New Meridian `User` aggregate (Mongo, keyed by Hub `sub`) tracks `hasCompletedOnboarding` and `timezone`. Server-side gate in the BFF callback on web; client-side gate in `app/app/layout.tsx` for desktop/Tauri and direct-URL hits. Onboarding completion POSTs through a dedicated BFF route that updates both the API and the iron-session cookie atomically.

**Tech Stack:** NestJS + Mongoose (DDD: Entity, Schema, Repository, Service, Controller, Zod DTO) on the API; Next.js 16 App Router + iron-session + React Query on the PWA. Bun runtime.

**Testing stance:** Manual verification only per project norms. No `*.spec.ts` files. See `docs/superpowers/specs/2026-04-20-onboarding-gate-design.md` for the manual verification checklist.

**Git stance:** The user handles all git operations. Plan shows logical commit points as comments, but does not execute `git add` or `git commit`.

---

## Task 1: Backend — `User` schema + entity

**Files:**

- Create: `apps/api/src/modules/user/user.schema.ts`
- Create: `apps/api/src/modules/user/user.entity.ts`

- [ ] **Step 1: Create the Mongoose schema**

`apps/api/src/modules/user/user.schema.ts`:

```ts
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { randomUUID } from "crypto";

export type UserDocument = UserModel & Document<string>;

@Schema({
  collection: "users",
  timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  toJSON: {
    transform: (_doc: any, ret: any) => {
      ret.id = ret._id;
      delete ret.__v;
      return ret;
    },
  },
})
export class UserModel {
  @Prop({ type: String, default: () => randomUUID() }) _id: string;
  @Prop({ type: String, required: true, unique: true, index: true })
  sub: string;
  @Prop({ type: Boolean, required: true, default: false })
  has_completed_onboarding: boolean;
  @Prop({ type: String, default: null }) timezone: string | null;
}

export const UserSchema = SchemaFactory.createForClass(UserModel);
```

- [ ] **Step 2: Create the domain entity**

`apps/api/src/modules/user/user.entity.ts`:

```ts
import { Entity, EntityProps, Ok, Err, Result } from "../../shared";

export interface UserProps extends EntityProps {
  sub: string;
  hasCompletedOnboarding: boolean;
  timezone: string | null;
}

export class User extends Entity<UserProps> {
  private constructor(props: UserProps, id?: string) {
    super(props, id);
  }

  get sub(): string {
    return this.get("sub");
  }
  get hasCompletedOnboarding(): boolean {
    return this.get("hasCompletedOnboarding");
  }
  get timezone(): string | null {
    return this.get("timezone");
  }

  completeOnboarding(timezone: string): void {
    this.set("hasCompletedOnboarding", true);
    this.set("timezone", timezone);
  }

  static create(
    props: Omit<UserProps, "id" | "createdAt" | "updatedAt">,
  ): Result<User> {
    if (!props.sub || props.sub.trim().length === 0) {
      return Err(new Error("sub is required"));
    }
    return Ok(new User({ ...props }));
  }

  static reconstitute(props: UserProps, id: string): User {
    return new User(props, id);
  }
}
```

- [ ] **Step 3: Commit point** (user runs git manually)

Logical commit: `feat(api): add User schema and entity for onboarding state`

---

## Task 2: Backend — `User` repository

**Files:**

- Create: `apps/api/src/modules/user/user.repository.ts`

- [ ] **Step 1: Create the repository**

`apps/api/src/modules/user/user.repository.ts`:

```ts
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { UserModel, UserDocument } from "./user.schema";
import { User } from "./user.entity";

@Injectable()
export class UserRepository {
  constructor(
    @InjectModel(UserModel.name) private model: Model<UserDocument>,
  ) {}

  async findBySub(sub: string): Promise<User | null> {
    const doc = await this.model.findOne({ sub }).lean();
    return doc ? this.toDomain(doc) : null;
  }

  async save(user: User): Promise<void> {
    const data = user.toObject();
    await this.model.updateOne(
      { sub: data.sub },
      {
        $set: {
          sub: data.sub,
          has_completed_onboarding: data.hasCompletedOnboarding,
          timezone: data.timezone,
        },
      },
      { upsert: true },
    );
  }

  // Hard-delete this user's row. Used by the Hub user.deleted cascade.
  async deleteBySub(sub: string): Promise<number> {
    const { deletedCount } = await this.model.deleteMany({ sub });
    return deletedCount ?? 0;
  }

  private toDomain(doc: any): User {
    return User.reconstitute(
      {
        sub: doc.sub,
        hasCompletedOnboarding: !!doc.has_completed_onboarding,
        timezone: doc.timezone ?? null,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      },
      doc._id,
    );
  }
}
```

- [ ] **Step 2: Commit point**

Logical commit: `feat(api): add User repository with findBySub/save/deleteBySub`

---

## Task 3: Backend — DTO + service

**Files:**

- Create: `apps/api/src/modules/user/user.dto.ts`
- Create: `apps/api/src/modules/user/user.service.ts`

- [ ] **Step 1: Create the Zod DTO**

`apps/api/src/modules/user/user.dto.ts`:

```ts
import { z } from "zod";

// IANA timezone validator — Node 20+ exposes Intl.supportedValuesOf.
const VALID_TIMEZONES = new Set(Intl.supportedValuesOf("timeZone"));

export const CompleteOnboardingDto = z.object({
  timezone: z
    .string()
    .min(1)
    .refine((tz) => VALID_TIMEZONES.has(tz), {
      message: "timezone must be a valid IANA zone",
    }),
});
export type CompleteOnboardingDto = z.infer<typeof CompleteOnboardingDto>;
```

- [ ] **Step 2: Create the service**

`apps/api/src/modules/user/user.service.ts`:

```ts
import { Injectable } from "@nestjs/common";
import { UserRepository } from "./user.repository";
import { User } from "./user.entity";

@Injectable()
export class UserService {
  constructor(private readonly repository: UserRepository) {}

  /**
   * Get the user's Meridian-side record, creating it on first access.
   * Called on every `GET /me` — the user's first sign-in is just the
   * first call that results in an insert.
   */
  async upsertBySub(sub: string): Promise<User> {
    const existing = await this.repository.findBySub(sub);
    if (existing) return existing;
    const created = User.create({
      sub,
      hasCompletedOnboarding: false,
      timezone: null,
    });
    if (!created.ok) throw created.error;
    await this.repository.save(created.value);
    return created.value;
  }

  async completeOnboarding(sub: string, timezone: string): Promise<User> {
    const user = await this.upsertBySub(sub);
    user.completeOnboarding(timezone);
    await this.repository.save(user);
    return user;
  }

  // Cascade from Hub user.deleted event.
  async deleteAllForUser(sub: string): Promise<number> {
    return this.repository.deleteBySub(sub);
  }
}
```

- [ ] **Step 3: Commit point**

Logical commit: `feat(api): add User service with upsert and complete-onboarding`

---

## Task 4: Backend — controller + module + wiring

**Files:**

- Create: `apps/api/src/modules/user/user.controller.ts`
- Create: `apps/api/src/modules/user/user.module.ts`
- Modify: `apps/api/src/modules/me/me.controller.ts`
- Modify: `apps/api/src/modules/me/me.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create the controller**

The spec says `/me` and `/me/onboarding/complete` — both live under the existing `MeController` because they share the `/me` path. Keep the `User` module for the service/repository and import it where needed.

`apps/api/src/modules/user/user.controller.ts` stays empty for now (we'll use `MeController` as the HTTP entry point). Skip this file.

Instead, create the module with just the providers:

`apps/api/src/modules/user/user.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { UserModel, UserSchema } from "./user.schema";
import { UserRepository } from "./user.repository";
import { UserService } from "./user.service";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: UserModel.name, schema: UserSchema }]),
  ],
  providers: [UserRepository, UserService],
  exports: [UserService],
})
export class UserModule {}
```

- [ ] **Step 2: Extend `MeController`**

`apps/api/src/modules/me/me.controller.ts` — add two handlers. Final file contents:

```ts
import { Controller, Get, Post, Body, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { StageholderRequest } from "../../common/types";
import { getPersonalOrgId } from "../../common/helpers/personal-org";
import { getMeridianLimit } from "../../common/helpers/entitlement";
import { UserService } from "../user/user.service";
import {
  CompleteOnboardingDto as CompleteOnboardingSchema,
  type CompleteOnboardingDto,
} from "../user/user.dto";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";

const PRODUCT_SLUG = "meridian";

@ApiTags("Me")
@Controller("me")
export class MeController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async me(@Req() req: StageholderRequest) {
    const user = await this.userService.upsertBySub(req.user.sub);
    return {
      sub: user.sub,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
      timezone: user.timezone,
    };
  }

  @Post("onboarding/complete")
  async completeOnboarding(
    @Req() req: StageholderRequest,
    @Body(new ZodValidationPipe(CompleteOnboardingSchema))
    dto: CompleteOnboardingDto,
  ) {
    const user = await this.userService.completeOnboarding(
      req.user.sub,
      dto.timezone,
    );
    return {
      sub: user.sub,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
      timezone: user.timezone,
    };
  }

  @Get("entitlement")
  entitlement(@Req() req: StageholderRequest) {
    const orgId = getPersonalOrgId(req.user);
    const plan =
      req.user.subscriptions?.find(
        (s) => s.orgId === orgId && s.product === PRODUCT_SLUG,
      )?.plan ?? "meridian-free";
    return {
      plan,
      entitled: true,
      limits: {
        max_habits: getMeridianLimit(req.user, "max_habits"),
        max_todo_lists: getMeridianLimit(req.user, "max_todo_lists"),
        max_active_todos: getMeridianLimit(req.user, "max_active_todos"),
      },
    };
  }
}
```

- [ ] **Step 3: Import `UserModule` into `MeModule`**

`apps/api/src/modules/me/me.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { MeController } from "./me.controller";
import { UserModule } from "../user/user.module";

@Module({
  imports: [UserModule],
  controllers: [MeController],
})
export class MeModule {}
```

- [ ] **Step 4: Register `UserModule` in `AppModule`**

`apps/api/src/app.module.ts` — add the import alongside the other modules. Locate this existing block (around line 10–25):

```ts
import { MeModule } from "./modules/me/me.module";
import { HubEventsModule } from "./modules/hub-events/hub-events.module";
```

Add after the `MeModule` import:

```ts
import { UserModule } from "./modules/user/user.module";
```

Then in the `@Module({ imports: [...] })` block, add `UserModule` next to `MeModule`:

```ts
    MeModule,
    UserModule,
    HubEventsModule,
```

Nothing else in `app.module.ts` changes. The global `AuthGuard` already protects `/me` and `/me/onboarding/complete`.

- [ ] **Step 5: Commit point**

Logical commit: `feat(api): expose GET /me and POST /me/onboarding/complete`

---

## Task 5: Frontend — extend `ProductSession`

**Files:**

- Modify: `apps/pwa/lib/session.ts`

- [ ] **Step 1: Add the two fields**

`apps/pwa/lib/session.ts` — replace the `ProductSession` interface. Final:

```ts
export interface ProductSession {
  sub: string;
  email?: string;
  name?: string;
  personalOrgId?: string | null;
  personalOrgSlug?: string | null;
  hasCompletedOnboarding?: boolean;
  timezone?: string | null;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number; // epoch seconds
}
```

Both new fields are optional. Legacy cookies minted before this change decrypt cleanly with both undefined — the callback fix-up fills them on the next sign-in.

- [ ] **Step 2: Commit point**

Logical commit: `feat(pwa): add onboarding fields to ProductSession`

---

## Task 6: Frontend — extend `/api/me` BFF response

**Files:**

- Modify: `apps/pwa/app/api/me/route.ts`

- [ ] **Step 1: Add the fields to `MeResponse` and the handler**

`apps/pwa/app/api/me/route.ts` — final:

```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface MeResponse {
  sub: string;
  email?: string;
  name?: string;
  personalOrgId: string | null;
  personalOrgSlug: string | null;
  hasCompletedOnboarding: boolean;
  timezone: string | null;
}

export async function GET() {
  const session = await getSession();
  if (!session.sub) {
    return new NextResponse(null, { status: 401 });
  }
  const body: MeResponse = {
    sub: session.sub,
    email: session.email,
    name: session.name,
    personalOrgId: session.personalOrgId ?? null,
    personalOrgSlug: session.personalOrgSlug ?? null,
    // Legacy sessions minted before the onboarding feature will have
    // these undefined. Treat undefined as "not onboarded" so the
    // user is walked through once on their next active request.
    hasCompletedOnboarding: session.hasCompletedOnboarding ?? false,
    timezone: session.timezone ?? null,
  };
  return NextResponse.json(body);
}
```

- [ ] **Step 2: Commit point**

Logical commit: `feat(pwa): return onboarding state from /api/me`

---

## Task 7: Frontend — extend callback to fetch flag + branch landing

**Files:**

- Modify: `apps/pwa/lib/oidc.ts`
- Modify: `apps/pwa/app/auth/callback/route.ts`

- [ ] **Step 1: Add `fetchMeridianMe` helper to `oidc.ts`**

`apps/pwa/lib/oidc.ts` — append at the bottom, after `revokeRefreshToken`:

```ts
export interface MeridianMeResponse {
  sub: string;
  hasCompletedOnboarding: boolean;
  timezone: string | null;
}

const MERIDIAN_API_URL =
  process.env.MERIDIAN_API_URL ?? "http://localhost:4000";

/**
 * Server-to-server call to the Meridian API's `GET /me`. Used by the BFF
 * callback route to read the user's onboarding flag during sign-in. The
 * API upserts the User document on first access, so this doubles as
 * just-in-time provisioning for first-time Meridian users.
 */
export async function fetchMeridianMe(
  accessToken: string,
): Promise<MeridianMeResponse> {
  const res = await fetch(`${MERIDIAN_API_URL}/api/v1/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    // Bound the login critical path — must not hang on a slow API.
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    throw new Error(`meridian /me request failed: ${res.status}`);
  }
  return (await res.json()) as MeridianMeResponse;
}
```

- [ ] **Step 2: Wire it into the callback**

`apps/pwa/app/auth/callback/route.ts` — modify. Locate the import block and add `fetchMeridianMe`:

```ts
import {
  exchangeCode,
  decodeIdToken,
  fetchUserinfo,
  fetchMeridianMe,
} from "@/lib/oidc";
```

After the existing personal-org lookup block (ends around line 63), and before `const session = await getSession()`, insert:

```ts
// Upsert the Meridian-side User document and read the onboarding flag.
// Non-fatal: if the API is unreachable the user lands on /onboarding,
// which is the correct state for a first-time user anyway — the
// completion POST surfaces any real outage.
let hasCompletedOnboarding = false;
let timezone: string | null = null;
try {
  const me = await fetchMeridianMe(tokens.access_token);
  hasCompletedOnboarding = me.hasCompletedOnboarding;
  timezone = me.timezone;
} catch {
  /* non-fatal — default to not-onboarded */
}
```

Extend the session save block — change from:

```ts
session.accessToken = tokens.access_token;
session.refreshToken = tokens.refresh_token;
```

to:

```ts
session.hasCompletedOnboarding = hasCompletedOnboarding;
session.timezone = timezone;
session.accessToken = tokens.access_token;
session.refreshToken = tokens.refresh_token;
```

Replace the `landing` computation (currently `returnTo ?? DEFAULT_LANDING`) with:

```ts
const safeReturnTo =
  returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
    ? returnTo
    : null;

const landing = !hasCompletedOnboarding
  ? "/onboarding"
  : (safeReturnTo ?? DEFAULT_LANDING);

return NextResponse.redirect(new URL(landing, req.url));
```

- [ ] **Step 3: Commit point**

Logical commit: `feat(pwa): gate callback landing on onboarding flag`

---

## Task 8: Frontend — dedicated BFF route for onboarding completion

**Files:**

- Create: `apps/pwa/app/api/me/onboarding/complete/route.ts`

- [ ] **Step 1: Create the route**

This is a dedicated route rather than a pass-through through the `/api/v1/[...path]` catch-all because we need to update the iron-session cookie atomically with the API write. If we used the catch-all, the session would stay stale (`hasCompletedOnboarding: false`) until the next sign-in, and the app layout would keep bouncing the user back.

`apps/pwa/app/api/me/onboarding/complete/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { refreshAccessToken } from "@/lib/oidc";
import type { ProductSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_URL = process.env.MERIDIAN_API_URL ?? "http://localhost:4000";
const REFRESH_LEEWAY_SECONDS = 60;

async function ensureFreshToken(
  session: Awaited<ReturnType<typeof getSession>>,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (session.accessTokenExpiresAt - REFRESH_LEEWAY_SECONDS > now) {
    return session.accessToken;
  }
  const refreshed = await refreshAccessToken(
    session as unknown as ProductSession,
  );
  session.accessToken = refreshed.accessToken;
  session.refreshToken = refreshed.refreshToken;
  session.accessTokenExpiresAt = refreshed.accessTokenExpiresAt;
  await session.save();
  return session.accessToken;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.sub) {
    return new NextResponse(null, { status: 401 });
  }

  let accessToken: string;
  try {
    accessToken = await ensureFreshToken(session);
  } catch {
    return new NextResponse(JSON.stringify({ code: "session_expired" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await req.text();

  const upstream = await fetch(`${API_URL}/api/v1/me/onboarding/complete`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body,
  });

  const respText = await upstream.text();

  if (upstream.ok) {
    try {
      const parsed = JSON.parse(respText) as {
        hasCompletedOnboarding: boolean;
        timezone: string | null;
      };
      session.hasCompletedOnboarding = parsed.hasCompletedOnboarding;
      session.timezone = parsed.timezone;
      await session.save();
    } catch {
      // Upstream returned non-JSON on 2xx — unexpected but not fatal.
      // Session stays stale; next sign-in will correct it.
    }
  }

  return new NextResponse(respText, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
```

- [ ] **Step 2: Commit point**

Logical commit: `feat(pwa): add BFF route to complete onboarding and refresh session`

---

## Task 9: Frontend — update `useUser` for desktop + shared types

**Files:**

- Modify: `apps/pwa/hooks/use-user.ts`

- [ ] **Step 1: Extend `MeridianUser` and the desktop fetcher**

`apps/pwa/hooks/use-user.ts` — final:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { detectPlatform } from "@repo/core/platform";
import type { MeResponse } from "@/app/api/me/route";

export type MeridianUser = MeResponse & {
  avatar?: string;
};

async function fetchMeWeb(): Promise<MeridianUser | null> {
  const res = await fetch("/api/me", { credentials: "include" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`GET /api/me failed: ${res.status}`);
  return (await res.json()) as MeridianUser;
}

const DESKTOP_API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

/**
 * Desktop: merge id_token profile claims (sub/email/name/organizations)
 * with Meridian-side state (onboarding flag, timezone) fetched from the
 * API directly — there's no BFF on desktop.
 */
async function fetchMeDesktop(): Promise<MeridianUser | null> {
  const { getSessionTauri } = await import("@/lib/oidc-tauri");
  const session = await getSessionTauri();
  if (!session) return null;

  const parts = session.idToken.split(".");
  if (parts.length < 2 || !parts[1]) return null;
  const payload = JSON.parse(
    atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
  ) as {
    sub: string;
    email?: string;
    name?: string;
    picture?: string;
    organizations?: { id: string; slug: string }[];
  };
  const personalOrg = payload.organizations?.[0];

  let hasCompletedOnboarding = false;
  let timezone: string | null = null;
  try {
    const res = await fetch(`${DESKTOP_API_URL}/me`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    if (res.ok) {
      const me = (await res.json()) as {
        hasCompletedOnboarding: boolean;
        timezone: string | null;
      };
      hasCompletedOnboarding = me.hasCompletedOnboarding;
      timezone = me.timezone;
    }
  } catch {
    /* non-fatal — default to not-onboarded, client gate will route */
  }

  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    personalOrgId: personalOrg?.id ?? null,
    personalOrgSlug: personalOrg?.slug ?? null,
    hasCompletedOnboarding,
    timezone,
    avatar: payload.picture,
  };
}

async function fetchMe(): Promise<MeridianUser | null> {
  if (detectPlatform() === "desktop") return fetchMeDesktop();
  return fetchMeWeb();
}

export function useUser() {
  return useQuery<MeridianUser | null>({
    queryKey: ["me"],
    queryFn: fetchMe,
    staleTime: 60_000,
    retry: false,
  });
}
```

**Note on desktop session shape:** This assumes `getSessionTauri()` returns an object with an `accessToken` field. If it currently returns only `{ idToken }`, extending it is part of this task — add `accessToken: string` to whatever shape is declared in `apps/pwa/lib/oidc-tauri.ts` and populate it at token-exchange time. If the field already exists under a different name (e.g., `access_token`), use that instead. This is a 5-second grep in `oidc-tauri.ts` before typing.

- [ ] **Step 2: Commit point**

Logical commit: `feat(pwa): fetch onboarding state for desktop useUser`

---

## Task 10: Frontend — app layout gate

**Files:**

- Modify: `apps/pwa/app/app/layout.tsx`

- [ ] **Step 1: Extend the existing auth-redirect effect**

`apps/pwa/app/app/layout.tsx` — locate the existing `useEffect` that handles unauthenticated redirect (it's the one currently reading `if (!userLoading && !user)`, around lines 172–183). Replace with:

```ts
useEffect(() => {
  if (userLoading) return;
  if (!user) {
    if (isDesktop()) {
      router.replace("/");
    } else {
      router.replace("/auth/login");
    }
    return;
  }
  if (user.hasCompletedOnboarding === false) {
    router.replace("/onboarding");
  }
}, [user, userLoading, router]);
```

Nothing else in the file changes.

- [ ] **Step 2: Commit point**

Logical commit: `feat(pwa): gate /app layout on onboarding completion`

---

## Task 11: Frontend — onboarding page state lift + re-entry guard

**Files:**

- Modify: `apps/pwa/app/onboarding/page.tsx`
- Modify: `apps/pwa/components/onboarding/profile-step.tsx`

- [ ] **Step 1: Update `OnboardingPage` — lift timezone, add re-entry guard, wire skip to POST**

`apps/pwa/app/onboarding/page.tsx` — replace with:

```tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { cn } from "@/lib/utils";
import { WelcomeStep } from "@/components/onboarding/welcome-step";
import { ProfileStep } from "@/components/onboarding/profile-step";
import { GoalsStep } from "@/components/onboarding/goals-step";
import { TourStep } from "@/components/onboarding/tour-step";
import { CompleteStep } from "@/components/onboarding/complete-step";

const TOTAL_STEPS = 5;

async function postCompletion(timezone: string): Promise<boolean> {
  try {
    const res = await fetch("/api/me/onboarding/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ timezone }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default function OnboardingPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useUser();
  const [step, setStep] = useState(0);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [timezone, setTimezone] = useState<string>(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  );

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/auth/login");
      return;
    }
    // Already onboarded — don't let the user re-enter the flow.
    if (user.hasCompletedOnboarding) {
      router.replace("/app");
    }
  }, [user, isLoading, router]);

  const finishOnboarding = useCallback(async () => {
    const ok = await postCompletion(timezone);
    if (!ok) {
      // CompleteStep surfaces the inline error; don't navigate on failure.
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["me"] });
    router.push("/app");
  }, [timezone, queryClient, router]);

  const handleSkip = useCallback(async () => {
    const ok = await postCompletion(timezone);
    if (!ok) {
      // Skip failing is rare; surface a minimal signal and stay.
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["me"] });
    router.push("/app");
  }, [timezone, queryClient, router]);

  if (!user) return null;

  const stepComponent = (() => {
    switch (step) {
      case 0:
        return (
          <WelcomeStep name={user.name ?? ""} onContinue={() => setStep(1)} />
        );
      case 1:
        return (
          <ProfileStep
            timezone={timezone}
            onTimezoneChange={setTimezone}
            onContinue={() => setStep(2)}
          />
        );
      case 2:
        return (
          <GoalsStep
            selectedGoals={selectedGoals}
            onGoalsChange={setSelectedGoals}
            onContinue={() => setStep(3)}
          />
        );
      case 3:
        return (
          <TourStep
            selectedGoals={selectedGoals}
            onContinue={() => setStep(4)}
          />
        );
      case 4:
        return <CompleteStep onFinish={finishOnboarding} />;
      default:
        return null;
    }
  })();

  const lastStep = TOTAL_STEPS - 1;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-center gap-2">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "size-2 rounded-full transition-colors",
              i === step
                ? "bg-primary"
                : i < step
                  ? "bg-primary/40"
                  : "bg-muted-foreground/20",
            )}
          />
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
        {stepComponent}
      </div>

      <div className="flex items-center justify-between">
        <div>
          {step > 0 && step < lastStep && (
            <button
              onClick={() => setStep(step - 1)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Back
            </button>
          )}
        </div>
        {step < lastStep && (
          <button
            onClick={handleSkip}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip setup
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `ProfileStep` to accept lifted timezone**

`apps/pwa/components/onboarding/profile-step.tsx` — replace with (keeping the existing visual structure, just swapping local state for props):

```tsx
"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/hooks/use-user";
import { TimezoneSelect } from "@/components/ui/timezone-select";

export function ProfileStep({
  timezone,
  onTimezoneChange,
  onContinue,
}: {
  timezone: string;
  onTimezoneChange: (value: string) => void;
  onContinue: () => void;
}) {
  const { data: user } = useUser();
  const [name, setName] = useState(user?.name || "");

  const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL;

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user]);

  function openHubProfile() {
    if (!HUB_URL) return;
    window.open(`${HUB_URL}/account/profile`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-foreground">
          Confirm your profile
        </h2>
        <p className="text-sm text-muted-foreground">
          Your name and email live in your Stageholder account. Edit them in the
          Hub at any time.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="onboard-name"
            className="block text-sm font-medium text-foreground"
          >
            Display name
          </label>
          <input
            id="onboard-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled
            className="mt-1 block w-full rounded-lg border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
          />
        </div>

        <div>
          <label
            htmlFor="onboard-tz"
            className="block text-sm font-medium text-foreground"
          >
            Timezone
          </label>
          <TimezoneSelect
            value={timezone}
            onValueChange={onTimezoneChange}
            className="mt-1"
          />
        </div>

        {HUB_URL && (
          <button
            type="button"
            onClick={openHubProfile}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Edit profile in Hub →
          </button>
        )}
      </div>

      <button
        onClick={onContinue}
        disabled={!name.trim()}
        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        Continue
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Commit point**

Logical commit: `feat(pwa): lift timezone to onboarding page, wire completion + skip`

---

## Task 12: Frontend — `CompleteStep` inline error + loading

**Files:**

- Modify: `apps/pwa/components/onboarding/complete-step.tsx`

- [ ] **Step 1: Surface failure + retry**

The current `handleFinish` sets `loading` but never unsets it or shows errors. Now that `onFinish` is async (`finishOnboarding` in the page), propagate the result and show an inline error on failure.

`apps/pwa/components/onboarding/complete-step.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Check } from "lucide-react";

export function CompleteStep({ onFinish }: { onFinish: () => Promise<void> }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFinish() {
    setError(null);
    setLoading(true);
    try {
      await onFinish();
    } catch {
      setError("We couldn't save that. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center text-center space-y-6">
      <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
        <Check className="size-8 text-primary" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-foreground">
          You&apos;re all set!
        </h2>
        <p className="text-muted-foreground">
          You&apos;re ready to go. Start building habits, tracking tasks, and
          journaling your journey.
        </p>
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <button
        onClick={handleFinish}
        disabled={loading}
        className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {loading ? "Saving..." : "Go to Dashboard"}
      </button>
    </div>
  );
}
```

Note: `finishOnboarding` in `onboarding/page.tsx` currently returns silently on POST failure. To make the `try/catch` above meaningful, change `postCompletion` returning `false` to **throw** instead — update the page:

```ts
async function postCompletion(timezone: string): Promise<void> {
  const res = await fetch("/api/me/onboarding/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ timezone }),
  });
  if (!res.ok) {
    throw new Error(`completion failed: ${res.status}`);
  }
}
```

And simplify `finishOnboarding` / `handleSkip` to let the error bubble:

```ts
const finishOnboarding = useCallback(async () => {
  await postCompletion(timezone); // throws on failure; CompleteStep catches
  await queryClient.invalidateQueries({ queryKey: ["me"] });
  router.push("/app");
}, [timezone, queryClient, router]);

const handleSkip = useCallback(async () => {
  try {
    await postCompletion(timezone);
    await queryClient.invalidateQueries({ queryKey: ["me"] });
    router.push("/app");
  } catch {
    // Skip failed — user can keep clicking skip or walk the flow.
    // Intentionally silent; CompleteStep is the primary error surface.
  }
}, [timezone, queryClient, router]);
```

- [ ] **Step 2: Commit point**

Logical commit: `feat(pwa): handle completion POST failures with inline retry`

---

## Manual Verification

Run the verification checklist from `docs/superpowers/specs/2026-04-20-onboarding-gate-design.md` (Manual Verification section). Covers: first sign-in, returning sign-in, skip, direct-URL guards (both directions), desktop, and API-down failure.

---

## Self-Review

**Spec coverage:**

- Data model (User entity keyed by sub, flag + timezone) → Tasks 1, 2.
- API surface (`GET /me`, `POST /me/onboarding/complete`) → Tasks 3, 4.
- Session shape extension → Task 5.
- BFF `/api/me` extension → Task 6.
- Callback gate + landing branch → Task 7.
- Dedicated BFF completion route with session update → Task 8.
- Desktop `useUser` extension → Task 9.
- App layout client-side gate → Task 10.
- Onboarding page timezone lifting + re-entry guard + skip wiring → Task 11.
- `CompleteStep` inline error handling → Task 12.
- Proxy untouched, Hub untouched — nothing to do.
- Manual verification only, no automated test files — in scope.

**Placeholder scan:** None. Every task has concrete code. No TBD, no "similar to Task N", no vague "add validation".

**Type consistency:**

- `hasCompletedOnboarding` spelled consistently across backend (entity, repo uses `has_completed_onboarding` in DB only), session, `MeResponse`, page, layout, and `useUser` — verified.
- `timezone` is `string | null` consistently; `undefined` only in legacy session fallback, coerced to `null` at the `/api/me` boundary.
- `MeridianMeResponse` in `oidc.ts` matches the `GET /me` return shape from `MeController.me`.
- `postCompletion` signature is reconciled in Task 12 (throws instead of returning false).
