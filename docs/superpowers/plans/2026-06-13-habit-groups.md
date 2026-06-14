# Habit Groups, Archiving & Sidebar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add customizable habit groups (seeded with time-of-day defaults), optional group membership, archiving with preserved history, drag-reorder, and a habits sidebar — at full PWA/mobile parity with the existing todo-list pattern.

**Architecture:** Mirror the proven `TodoList ↔ Todo` backend module. Add a `HabitGroup` NestJS DDD module and three fields to `Habit` (`groupId` nullable, `order`, `archivedAt`). Surface grouping through the kit's cross-platform `Sidebar`, `Sortable`, and `FormSheet` primitives (`@stageholder/ui` `0.3.0-alpha.43`) — no bespoke drag/sidebar code.

**Tech Stack:** NestJS + Mongoose + Zod (API), DDD `Entity/Result/Repository`, `@repo/core` (shared types + axios factory), `@repo/features` (cross-platform Tamagui components), Vite + TanStack Router (PWA), Expo Router (mobile), TanStack Query, `@stageholder/ui` kit.

---

## Project Conventions (READ FIRST — they override the skill defaults)

These come from the project's established preferences. Every task below assumes them:

1. **No automated tests.** Manual verification only. Tasks end with a **Manual verification** note, not a test step. Do NOT add `*.spec.ts`/RTL/E2E.
2. **No git operations by the implementer.** The user commits. Each task ends with a **Commit (user)** note listing the files to stage — do not run `git`.
3. **No build runs during implementation.** Do not run `bun run build`/`tsc`/Vite. The user verifies the build at the end. (You MAY use IDE/LSP diagnostics to sanity-check a file you just wrote.)
4. **Always read a file before editing it.** The large UI hosts (`habit-card.tsx` ~796 lines, `todo-list-sidebar.tsx`, mobile dialogs) are referenced by path + insertion point; read them at execution and follow the cited pattern.
5. **Bun** is package manager + runtime. Use `bun`/`bunx`, never `npm`/`npx`.
6. **Encryption:** habit/group `name` (and habit `description`) are encrypted at rest via `EncryptionService.encryptRecord`. New non-text fields (`group_id`, `order`, `archived_at`) are NOT encrypted.

---

## File Structure

**Backend — new module `apps/api/src/modules/habit-group/`** (mirrors `todo-list/`):

- `habit-group.entity.ts` — domain entity (`name/color/icon/order/userSub`)
- `habit-group.schema.ts` — Mongoose model + indexes
- `habit-group.repository.ts` — persistence + encryption
- `habit-group.service.ts` — CRUD + time-of-day seeding + orphan-on-delete
- `habit-group.controller.ts` — REST routes
- `habit-group.dto.ts` — Zod create/update/reorder DTOs
- `habit-group.module.ts` — wires the above; imports `HabitModule`

**Backend — modified:**

- `apps/api/src/modules/habit/habit.entity.ts` — add `groupId/order/archivedAt`
- `.../habit/habit.schema.ts` — add columns + index
- `.../habit/habit.repository.ts` — persist/read new fields; exclude archived; orphan + reorder helpers
- `.../habit/habit.service.ts` — groupId on create/update; archive/unarchive; reorder; archived list
- `.../habit/habit.controller.ts` — query params + reorder + archive routes
- `.../habit/habit.dto.ts` — `groupId` + `ReorderHabitsDto`
- `apps/api/src/app.module.ts` (or the modules barrel) — register `HabitGroupModule`

**Shared core — modified:**

- `packages/core/src/types/habit.ts` — `HabitGroup` type + 3 new `Habit` fields
- `packages/core/src/api/habits.ts` — group CRUD/reorder, habit reorder/archive
- `packages/core/src/habits/entry-resolution.ts` — exclude archived from ring math

**Shared features — new:**

- `packages/features/src/habits/habit-group-form.tsx` — cross-platform group form
- `packages/features/src/habits/index.ts` — export it

**Shared features — modified:**

- `packages/features/src/habits/habit-card.tsx` — Archive/Unarchive + Move-to-group menu items + drag affordance prop

**PWA — new:**

- `apps/pwa/src/lib/api/habit-groups.ts` — group hooks
- `apps/pwa/src/components/habits/habits-sidebar.tsx` — kit `Sidebar`
- `apps/pwa/src/components/habits/habit-group-dialog.tsx` — create/edit group
- `apps/pwa/src/routes/_app/habits/$groupId.tsx`, `.../archived.tsx`

**PWA — modified:**

- `apps/pwa/src/lib/api/habits.ts` — reorder/archive/unarchive hooks
- `apps/pwa/src/lib/api/clients.ts` — (verify `habitsApi` exposes new methods — it's the same factory)
- `apps/pwa/src/routes/_app/habits/index.tsx` — section-by-group + `Sortable`
- `apps/pwa/src/components/habits/habit-form.tsx` — group `Select`
- `apps/pwa/src/routes/_app/habits/route.tsx` (or `_app/route.tsx`) — mount the sidebar

**Mobile — new:**

- `apps/mobile/lib/api/hooks/habit-groups.ts` — group hooks
- `apps/mobile/components/habit-group-sheet.tsx` — create/edit group sheet

**Mobile — modified:**

- `apps/mobile/lib/api/hooks/habits.ts` — reorder/archive/unarchive
- `apps/mobile/lib/api/Provider.tsx` — bump persisted-cache `buster`
- `apps/mobile/app/(authed)/habits.tsx` — chips rail + sections + `Sortable`

---

# PHASE 0 — Prerequisite: kit version bump

### Task 0.1: Bump `@stageholder/ui` to `^0.3.0-alpha.43`

`Sidebar`, `Sortable`(+`.native`), and `Kanban` ship at `0.3.0-alpha.43`. Meridian is pinned to `^alpha.38`.

**Files:**

- Modify: `apps/pwa/package.json`, `apps/mobile/package.json`, `packages/features/package.json` (devDependency)

- [ ] **Step 1: Confirm the published version**

Run: `bunx npm view @stageholder/ui version` (registry is GitHub Packages — `GITHUB_PACKAGES_TOKEN` must be loaded; if it 404s, the token/env isn't set — stop and tell the user).
Expected: `0.3.0-alpha.43` (or newer). Use whatever is current as the pin.

- [ ] **Step 2: Update each `@stageholder/ui` pin** to `^0.3.0-alpha.43` in the three `package.json` files (pwa/mobile dependencies, features devDependencies — match the existing dependency section it already lives in).

- [ ] **Step 3: Install**

Run: `bun install`

- [ ] **Step 4: Clear stale copies (per project memory)**

Run: `rm -rf apps/pwa/.vite` and check for nested stale copies:
Run: `find apps packages -path '*/node_modules/@stageholder/ui/package.json' -not -path '*/node_modules/.bin/*'`
Expected: only the hoisted root copy at version alpha.43; if a nested `packages/features/node_modules/@stageholder/ui` exists at an older version, remove it and re-run `bun install`.

- [ ] **Step 5: Verify the new exports exist**

Run: `bunx tsc --noEmit -p apps/pwa/tsconfig.json --skipLibCheck false 2>/dev/null; node -e "const k=require('@stageholder/ui'); console.log(['Sidebar','Sortable'].map(n=>n+':'+(n in k)).join(' '))"`
Expected: `Sidebar:true Sortable:true`. If `false`, the components are not in the published dist — STOP and tell the user (they own `~/Project/stageholder-ui`; it may need a publish of `Sidebar`/`Sortable`).

**Manual verification:** PWA + mobile still start and render existing screens (user does this).
**Commit (user):** the three `package.json` files + `bun.lock`.

---

# PHASE 1 — Backend

Independently testable via the API (curl/Bruno) once done.

### Task 1.1: `HabitGroup` entity

**Files:**

- Create: `apps/api/src/modules/habit-group/habit-group.entity.ts`

- [ ] **Step 1: Write the entity** (mirrors `todo-list.entity.ts`, adds `order`)

```ts
import { Entity, EntityProps, Ok, Err, Result } from "../../shared";

export interface HabitGroupProps extends EntityProps {
  name: string;
  color?: string;
  icon?: string;
  order: number;
  userSub: string;
}

export class HabitGroup extends Entity<HabitGroupProps> {
  private constructor(props: HabitGroupProps, id?: string) {
    super(props, id);
  }

  get name(): string {
    return this.get("name");
  }
  get color(): string | undefined {
    return this.get("color");
  }
  get icon(): string | undefined {
    return this.get("icon");
  }
  get order(): number {
    return this.get("order");
  }
  get userSub(): string {
    return this.get("userSub");
  }

  updateName(name: string): void {
    this.set("name", name);
  }
  updateColor(color: string | undefined): void {
    this.set("color", color);
  }
  updateIcon(icon: string | undefined): void {
    this.set("icon", icon);
  }
  updateOrder(order: number): void {
    this.set("order", order);
  }

  static create(
    props: Omit<HabitGroupProps, "id" | "createdAt" | "updatedAt" | "order"> & {
      order?: number;
    },
  ): Result<HabitGroup> {
    if (!props.name || props.name.trim().length === 0)
      return Err(new Error("Habit group name is required"));
    if (!props.userSub) return Err(new Error("User is required"));
    return Ok(
      new HabitGroup({
        ...props,
        order: props.order ?? 0,
      } as HabitGroupProps),
    );
  }

  static reconstitute(props: HabitGroupProps, id: string): HabitGroup {
    return new HabitGroup(props, id);
  }
}
```

**Manual verification:** none yet (used by later tasks).
**Commit (user):** the new file.

### Task 1.2: `HabitGroup` schema

**Files:**

- Create: `apps/api/src/modules/habit-group/habit-group.schema.ts`

- [ ] **Step 1: Write the schema** (mirrors `todo-list.schema.ts`; `order` instead of `is_default`)

```ts
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { randomUUID } from "crypto";

export type HabitGroupDocument = HabitGroupModel & Document<string>;

@Schema({
  collection: "habit_groups",
  timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  toJSON: {
    transform: (_doc: any, ret: any) => {
      ret.id = ret._id;
      delete ret.__v;
      return ret;
    },
  },
})
export class HabitGroupModel {
  @Prop({ type: String, default: () => randomUUID() }) _id: string;
  @Prop({ type: String, required: true, trim: true }) name: string;
  @Prop({ type: String }) color: string;
  @Prop({ type: String }) icon: string;
  @Prop({ type: Number, required: true, default: 0 }) order: number;
  @Prop({ type: String, required: true, index: true }) userSub: string;
  @Prop({ type: Date, default: null }) deleted_at: Date;
}

export const HabitGroupSchema = SchemaFactory.createForClass(HabitGroupModel);
HabitGroupSchema.index({ userSub: 1, order: 1 });
```

**Commit (user):** the new file.

### Task 1.3: `HabitGroup` repository

**Files:**

- Create: `apps/api/src/modules/habit-group/habit-group.repository.ts`

- [ ] **Step 1: Write the repository** (mirrors `todo-list.repository.ts`; encrypts `name`; adds `countAllForUser` including soft-deleted for the seed guard, and `findByUser` ordered by `order`)

```ts
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { HabitGroupModel, HabitGroupDocument } from "./habit-group.schema";
import { HabitGroup } from "./habit-group.entity";
import { EncryptionService } from "../encryption";

const ENCRYPTED_FIELDS = ["name"];

@Injectable()
export class HabitGroupRepository {
  constructor(
    @InjectModel(HabitGroupModel.name) private model: Model<HabitGroupDocument>,
    private readonly encryption: EncryptionService,
  ) {}

  async save(group: HabitGroup): Promise<void> {
    const data = group.toObject();
    const enc = this.encryption.encryptRecord(
      { name: data.name },
      ENCRYPTED_FIELDS,
    );
    await this.model.updateOne(
      { _id: data.id },
      {
        $set: {
          name: enc.name,
          color: data.color,
          icon: data.icon,
          order: data.order,
          userSub: data.userSub,
        },
      },
      { upsert: true },
    );
  }

  async findById(userSub: string, id: string): Promise<HabitGroup | null> {
    const doc = await this.model
      .findOne({ _id: id, userSub, deleted_at: null })
      .lean();
    return doc ? this.toDomain(doc) : null;
  }

  async findByUser(userSub: string): Promise<HabitGroup[]> {
    const docs = await this.model
      .find({ userSub, deleted_at: null })
      .sort({ order: 1, created_at: 1 })
      .lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  /** Counts non-soft-deleted groups — used for entitlement enforcement. */
  async countForUser(userSub: string): Promise<number> {
    return this.model.countDocuments({ userSub, deleted_at: null });
  }

  /**
   * Counts ALL groups for the user INCLUDING soft-deleted. The time-of-day
   * seed runs only when this is zero, so deleting every group does not
   * re-spawn the four defaults on the next fetch.
   */
  async countAllForUser(userSub: string): Promise<number> {
    return this.model.countDocuments({ userSub });
  }

  async delete(userSub: string, id: string): Promise<void> {
    await this.model.updateOne(
      { _id: id, userSub },
      { $set: { deleted_at: new Date() } },
    );
  }

  async deleteAllForUser(userSub: string): Promise<number> {
    const { deletedCount } = await this.model.deleteMany({ userSub });
    return deletedCount ?? 0;
  }

  async findUpdatedSince(
    userSub: string,
    since: string,
    includeSoftDeleted = false,
  ): Promise<HabitGroup[]> {
    const filter: any = { userSub, updated_at: { $gt: new Date(since) } };
    if (!includeSoftDeleted) filter.deleted_at = null;
    const docs = await this.model.find(filter).lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  private toDomain(doc: any): HabitGroup {
    const dec = this.encryption.decryptRecord(
      { name: doc.name },
      ENCRYPTED_FIELDS,
    );
    return HabitGroup.reconstitute(
      {
        name: dec.name,
        color: doc.color,
        icon: doc.icon,
        order: doc.order ?? 0,
        userSub: doc.userSub,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      },
      doc._id,
    );
  }
}
```

**Commit (user):** the new file.

### Task 1.4: Habit repository — orphan + clear-group helper

The group service must null out member habits on delete. Add the helper to `HabitRepository` now so the group module can call it.

**Files:**

- Modify: `apps/api/src/modules/habit/habit.repository.ts`

- [ ] **Step 1: Add `clearGroupForHabits`** after `deleteByList`-equivalent location (after the `delete` method, around line 120). Insert:

```ts
  /**
   * On habit-group deletion, orphan its members rather than cascade-deleting
   * them: clear `group_id` so the habits fall back to "Ungrouped". History
   * (entries/streaks) is untouched.
   */
  async clearGroup(userSub: string, groupId: string): Promise<void> {
    await this.model.updateMany(
      { userSub, group_id: groupId, deleted_at: null },
      { $set: { group_id: null } },
    );
  }
```

> Note: this references `group_id`, added to the schema in Task 1.7. It compiles regardless (Mongoose update objects are untyped), but do Task 1.7 before exercising it.

**Commit (user):** the modified file.

### Task 1.5: `HabitGroup` DTOs

**Files:**

- Create: `apps/api/src/modules/habit-group/habit-group.dto.ts`

- [ ] **Step 1: Write the DTOs** (mirror `todo-list.dto.ts`; add reorder)

```ts
import { z } from "zod";

export const CreateHabitGroupDto = z.object({
  name: z.string().min(1, "Name is required").max(100),
  color: z.string().max(20).optional(),
  icon: z.string().max(50).optional(),
});
export type CreateHabitGroupDto = z.infer<typeof CreateHabitGroupDto>;

export const UpdateHabitGroupDto = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().max(20).optional(),
  icon: z.string().max(50).optional(),
});
export type UpdateHabitGroupDto = z.infer<typeof UpdateHabitGroupDto>;

export const ReorderHabitGroupsDto = z.object({
  items: z.array(z.object({ id: z.string(), order: z.number() })),
});
export type ReorderHabitGroupsDto = z.infer<typeof ReorderHabitGroupsDto>;
```

**Commit (user):** the new file.

### Task 1.6: `HabitGroup` service + controller + module

**Files:**

- Create: `apps/api/src/modules/habit-group/habit-group.service.ts`
- Create: `apps/api/src/modules/habit-group/habit-group.controller.ts`
- Create: `apps/api/src/modules/habit-group/habit-group.module.ts`

- [ ] **Step 1: Write the service** (seeding + CRUD + orphan-on-delete + reorder)

```ts
import { Injectable, NotFoundException } from "@nestjs/common";
import type { StageholderUser } from "@stageholder/sdk/core";
import { HabitGroupRepository } from "./habit-group.repository";
import { HabitGroup } from "./habit-group.entity";
import {
  CreateHabitGroupDto,
  UpdateHabitGroupDto,
  ReorderHabitGroupsDto,
} from "./habit-group.dto";
import { HabitRepository } from "../habit/habit.repository";
import { enforceLimit } from "../../common/helpers/entitlement";

// Seeded once on first access. Editable/deletable like any group.
const TIME_OF_DAY_SEED: { name: string; color: string; icon: string }[] = [
  { name: "Morning", color: "#f59e0b", icon: "🌅" },
  { name: "Afternoon", color: "#0ea5e9", icon: "☀️" },
  { name: "Evening", color: "#6366f1", icon: "🌙" },
  { name: "Anytime", color: "#64748b", icon: "✨" },
];

@Injectable()
export class HabitGroupService {
  constructor(
    private readonly repository: HabitGroupRepository,
    private readonly habitRepository: HabitRepository,
  ) {}

  /**
   * Seed the four time-of-day groups, but ONLY if the user has never had any
   * group (count includes soft-deleted). Guarantees deleting all four does not
   * re-spawn them.
   */
  private async ensureSeed(userSub: string): Promise<void> {
    const everHad = await this.repository.countAllForUser(userSub);
    if (everHad > 0) return;
    for (let i = 0; i < TIME_OF_DAY_SEED.length; i++) {
      const seed = TIME_OF_DAY_SEED[i]!;
      const result = HabitGroup.create({
        name: seed.name,
        color: seed.color,
        icon: seed.icon,
        order: i,
        userSub,
      });
      if (result.ok) await this.repository.save(result.value);
    }
  }

  async create(
    userSub: string,
    dto: CreateHabitGroupDto,
    user: StageholderUser,
  ): Promise<HabitGroup> {
    await enforceLimit(user, "max_habit_groups", () =>
      this.repository.countForUser(userSub),
    );
    const order = await this.repository.countForUser(userSub);
    const result = HabitGroup.create({
      name: dto.name,
      color: dto.color,
      icon: dto.icon,
      order,
      userSub,
    });
    if (!result.ok) throw result.error;
    await this.repository.save(result.value);
    return result.value;
  }

  async findByUser(
    userSub: string,
  ): Promise<ReturnType<HabitGroup["toObject"]>[]> {
    await this.ensureSeed(userSub);
    const groups = await this.repository.findByUser(userSub);
    return groups.map((g) => g.toObject());
  }

  async findUpdatedSince(
    userSub: string,
    since: string,
    includeSoftDeleted = false,
  ): Promise<ReturnType<HabitGroup["toObject"]>[]> {
    const groups = await this.repository.findUpdatedSince(
      userSub,
      since,
      includeSoftDeleted,
    );
    return groups.map((g) => g.toObject());
  }

  async findById(userSub: string, id: string): Promise<HabitGroup> {
    const group = await this.repository.findById(userSub, id);
    if (!group) throw new NotFoundException("Habit group not found");
    return group;
  }

  async update(
    userSub: string,
    id: string,
    dto: UpdateHabitGroupDto,
  ): Promise<HabitGroup> {
    const group = await this.findById(userSub, id);
    if (dto.name) group.updateName(dto.name);
    if (dto.color !== undefined) group.updateColor(dto.color);
    if (dto.icon !== undefined) group.updateIcon(dto.icon);
    await this.repository.save(group);
    return group;
  }

  async reorder(userSub: string, dto: ReorderHabitGroupsDto): Promise<void> {
    for (const item of dto.items) {
      const group = await this.repository.findById(userSub, item.id);
      if (group) {
        group.updateOrder(item.order);
        await this.repository.save(group);
      }
    }
  }

  /** Soft-delete the group and ORPHAN its habits (group_id → null). */
  async delete(userSub: string, id: string): Promise<void> {
    await this.findById(userSub, id);
    await this.habitRepository.clearGroup(userSub, id);
    await this.repository.delete(userSub, id);
  }

  async deleteAllForUser(userSub: string): Promise<number> {
    return this.repository.deleteAllForUser(userSub);
  }
}
```

- [ ] **Step 2: Write the controller** (mirror `todo-list.controller.ts`; add reorder route)

```ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { HabitGroupService } from "./habit-group.service";
import {
  CreateHabitGroupDto,
  UpdateHabitGroupDto,
  ReorderHabitGroupsDto,
} from "./habit-group.dto";
import {
  CreateHabitGroupDto as CreateSchema,
  UpdateHabitGroupDto as UpdateSchema,
  ReorderHabitGroupsDto as ReorderSchema,
} from "./habit-group.dto";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { StageholderRequest } from "../../common/types";

@ApiTags("Habit Groups")
@Controller("habit-groups")
export class HabitGroupController {
  constructor(private readonly service: HabitGroupService) {}

  @Post()
  async create(
    @Req() req: StageholderRequest,
    @Body(new ZodValidationPipe(CreateSchema)) dto: CreateHabitGroupDto,
  ) {
    return (await this.service.create(req.user.sub, dto, req.user)).toObject();
  }

  @Get()
  async list(
    @Req() req: StageholderRequest,
    @Query("updatedSince") updatedSince?: string,
    @Query("includeSoftDeleted") includeSoftDeleted?: string,
  ) {
    if (updatedSince) {
      return this.service.findUpdatedSince(
        req.user.sub,
        updatedSince,
        includeSoftDeleted === "true",
      );
    }
    return this.service.findByUser(req.user.sub);
  }

  @Post("reorder")
  async reorder(
    @Req() req: StageholderRequest,
    @Body(new ZodValidationPipe(ReorderSchema)) dto: ReorderHabitGroupsDto,
  ) {
    await this.service.reorder(req.user.sub, dto);
    return { reordered: true };
  }

  @Get(":id")
  async get(@Req() req: StageholderRequest, @Param("id") id: string) {
    return (await this.service.findById(req.user.sub, id)).toObject();
  }

  @Patch(":id")
  async update(
    @Req() req: StageholderRequest,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateSchema)) dto: UpdateHabitGroupDto,
  ) {
    return (await this.service.update(req.user.sub, id, dto)).toObject();
  }

  @Delete(":id")
  async delete(@Req() req: StageholderRequest, @Param("id") id: string) {
    await this.service.delete(req.user.sub, id);
    return { deleted: true };
  }
}
```

> Route ordering note: `@Post("reorder")` is declared before `@Get(":id")`/`@Patch(":id")` — Nest matches the static `reorder` path correctly because it's a `POST` and the param routes are `GET`/`PATCH`, but keeping `reorder` above the param routes also matches the `todo.controller.ts` convention.

- [ ] **Step 3: Write the module** (mirror `todo-list.module.ts`; import `HabitModule` for the repo)

```ts
import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { HabitGroupModel, HabitGroupSchema } from "./habit-group.schema";
import { HabitGroupRepository } from "./habit-group.repository";
import { HabitGroupService } from "./habit-group.service";
import { HabitGroupController } from "./habit-group.controller";
import { HabitModule } from "../habit/habit.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HabitGroupModel.name, schema: HabitGroupSchema },
    ]),
    HabitModule,
  ],
  controllers: [HabitGroupController],
  providers: [HabitGroupRepository, HabitGroupService],
  exports: [HabitGroupService],
})
export class HabitGroupModule {}
```

> `HabitModule` already `exports: [HabitService, HabitRepository]` (confirmed in `habit.module.ts:14`), so `HabitRepository` injects cleanly into `HabitGroupService`.

**Commit (user):** the three new files.

### Task 1.7: `Habit` entity + schema — add `groupId`, `order`, `archivedAt`

**Files:**

- Modify: `apps/api/src/modules/habit/habit.entity.ts`
- Modify: `apps/api/src/modules/habit/habit.schema.ts`

- [ ] **Step 1: Extend `HabitProps`** (`habit.entity.ts:5-16`) — add three fields after `userSub`:

```ts
export interface HabitProps extends EntityProps {
  name: string;
  description?: string;
  frequency: HabitFrequency;
  targetCount: number;
  scheduledDays?: number[];
  weeklyTarget?: number;
  unit?: string;
  color?: string;
  icon?: string;
  userSub: string;
  groupId?: string | null;
  order: number;
  archivedAt?: string | null;
}
```

- [ ] **Step 2: Add getters** after the `userSub` getter (`habit.entity.ts:52`):

```ts
  get groupId(): string | null | undefined {
    return this.get("groupId");
  }
  get order(): number {
    return this.get("order");
  }
  get archivedAt(): string | null | undefined {
    return this.get("archivedAt");
  }
```

- [ ] **Step 3: Add setters** after `updateIcon` (`habit.entity.ts:80`):

```ts
  updateGroupId(groupId: string | null): void {
    this.set("groupId", groupId);
  }
  updateOrder(order: number): void {
    this.set("order", order);
  }
  archive(): void {
    this.set("archivedAt", new Date().toISOString());
  }
  unarchive(): void {
    this.set("archivedAt", null);
  }
```

- [ ] **Step 4: Default the new fields in `create`** (`habit.entity.ts:90-95`) — replace the `Ok(new Habit({...}))` block:

```ts
return Ok(
  new Habit({
    ...props,
    frequency: props.frequency || "daily",
    groupId: props.groupId ?? null,
    order: props.order ?? 0,
    archivedAt: props.archivedAt ?? null,
  } as HabitProps),
);
```

- [ ] **Step 5: Add the schema columns** (`habit.schema.ts`) — after the `userSub` prop (line 29), before `deleted_at`:

```ts
  @Prop({ type: String, default: null, index: true }) group_id: string | null;
  @Prop({ type: Number, required: true, default: 0 }) order: number;
  @Prop({ type: Date, default: null }) archived_at: Date;
```

- [ ] **Step 6: Add a grouped/active index** (`habit.schema.ts`, after line 34):

```ts
HabitSchema.index({ userSub: 1, group_id: 1, order: 1 });
```

**Manual verification:** none yet.
**Commit (user):** the two modified files.

### Task 1.8: Habit repository — persist/read new fields, exclude archived, reorder

**Files:**

- Modify: `apps/api/src/modules/habit/habit.repository.ts`

- [ ] **Step 1: Persist the new fields in `save`** (`habit.repository.ts:23-40`) — add to the `$set` object after `userSub: data.userSub,`:

```ts
          group_id: data.groupId ?? null,
          order: data.order,
          archived_at: data.archivedAt ? new Date(data.archivedAt) : null,
```

- [ ] **Step 2: Map them in `toDomain`** (`habit.repository.ts:148-164`) — add to the `reconstitute` props after `userSub: doc.userSub,`:

```ts
        groupId: doc.group_id ?? null,
        order: doc.order ?? 0,
        archivedAt: doc.archived_at
          ? new Date(doc.archived_at).toISOString()
          : null,
```

- [ ] **Step 3: Exclude archived from the default lists.** In `findByUser` (line 50-53) and `findByUserPaginated` (line 55-71) and `findIdsByUser` (86-92) and `findIdsByUserBefore` (99-113), add `archived_at: null` to each `{ userSub, deleted_at: null }` filter. Example for `findByUser`:

```ts
  async findByUser(userSub: string): Promise<Habit[]> {
    const docs = await this.model
      .find({ userSub, deleted_at: null, archived_at: null })
      .lean();
    return docs.map((doc) => this.toDomain(doc));
  }
```

Apply the same `archived_at: null` addition to the `find`/`countDocuments` filters in `findByUserPaginated`, `findIdsByUser`, and `findIdsByUserBefore`. **Do NOT** change `countActiveForUser` (archived habits still count toward `max_habits` so archiving can't be used to bypass the entitlement), `findById` (detail/restore must still resolve an archived habit), `findUpdatedSince` (sync must see archive changes), or `delete`/`deleteAllForUser`.

- [ ] **Step 4: Add archived-list + reorder + sort helpers.** Insert after `findByUserPaginated` (around line 71):

```ts
  /** Habits in one group, ordered. groupId `null` returns the Ungrouped set. */
  async findByGroup(
    userSub: string,
    groupId: string | null,
  ): Promise<Habit[]> {
    const docs = await this.model
      .find({ userSub, deleted_at: null, archived_at: null, group_id: groupId })
      .sort({ order: 1, created_at: -1 })
      .lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  /** Archived (non-deleted) habits for the Archived view. */
  async findArchivedByUser(userSub: string): Promise<Habit[]> {
    const docs = await this.model
      .find({ userSub, deleted_at: null, archived_at: { $ne: null } })
      .sort({ created_at: -1 })
      .lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  /** Count active habits already in a group (for initial `order` on create). */
  async countByGroup(
    userSub: string,
    groupId: string | null,
  ): Promise<number> {
    return this.model.countDocuments({
      userSub,
      deleted_at: null,
      archived_at: null,
      group_id: groupId,
    });
  }
```

**Manual verification:** none yet.
**Commit (user):** the modified file.

### Task 1.9: Habit DTOs — `groupId` + reorder

**Files:**

- Modify: `apps/api/src/modules/habit/habit.dto.ts`

- [ ] **Step 1: Add `groupId` to `CreateHabitDto`** (after `icon`, line 15):

```ts
  groupId: z.string().nullable().optional(),
```

- [ ] **Step 2: Add `groupId` to `UpdateHabitDto`** (after `icon`, line 32):

```ts
  groupId: z.string().nullable().optional(),
```

- [ ] **Step 3: Add the reorder DTO** at the end of the file:

```ts
export const ReorderHabitsDto = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      order: z.number(),
      // Optional: when present, also move the habit to this group in the same
      // operation (drag-between-groups). `null` clears the group (→ Ungrouped).
      groupId: z.string().nullable().optional(),
    }),
  ),
});
export type ReorderHabitsDto = z.infer<typeof ReorderHabitsDto>;
```

**Commit (user):** the modified file.

### Task 1.10: Habit service — groupId, archive/unarchive, reorder, archived list

**Files:**

- Modify: `apps/api/src/modules/habit/habit.service.ts`

- [ ] **Step 1: Update imports** (line 5) to include the reorder DTO:

```ts
import { CreateHabitDto, UpdateHabitDto, ReorderHabitsDto } from "./habit.dto";
```

- [ ] **Step 2: Set `groupId` + initial `order` on create** (`habit.service.ts:26-37`) — replace the `Habit.create({...})` call:

```ts
const groupId = dto.groupId ?? null;
const order = await this.repository.countByGroup(userSub, groupId);
const result = Habit.create({
  name: dto.name,
  description: dto.description,
  frequency: dto.frequency || "daily",
  targetCount: dto.targetCount,
  scheduledDays: dto.scheduledDays,
  weeklyTarget: dto.weeklyTarget,
  unit: dto.unit,
  color: dto.color,
  icon: dto.icon,
  userSub,
  groupId,
  order,
});
```

- [ ] **Step 3: Honor `groupId` in `update`** (`habit.service.ts:96`, after the `icon` line):

```ts
if (dto.groupId !== undefined) habit.updateGroupId(dto.groupId ?? null);
```

- [ ] **Step 4: Add archive/unarchive/reorder/archived-list methods** after `update` (around line 99):

```ts
  async archive(userSub: string, id: string): Promise<Habit> {
    const habit = await this.findById(userSub, id);
    habit.archive();
    await this.repository.save(habit);
    return habit;
  }

  async unarchive(userSub: string, id: string): Promise<Habit> {
    const habit = await this.findById(userSub, id);
    habit.unarchive();
    await this.repository.save(habit);
    return habit;
  }

  async reorder(userSub: string, dto: ReorderHabitsDto): Promise<void> {
    for (const item of dto.items) {
      const habit = await this.repository.findById(userSub, item.id);
      if (!habit) continue;
      habit.updateOrder(item.order);
      if (item.groupId !== undefined) habit.updateGroupId(item.groupId ?? null);
      await this.repository.save(habit);
    }
  }

  async listArchived(userSub: string) {
    const habits = await this.repository.findArchivedByUser(userSub);
    return habits.map((h) => h.toObject());
  }
```

> `findById` (line 74-78) filters only `deleted_at: null`, so it still resolves archived habits — archive/unarchive/restore work correctly.

**Commit (user):** the modified file.

### Task 1.11: Habit controller — query params + reorder + archive routes

**Files:**

- Modify: `apps/api/src/modules/habit/habit.controller.ts`

- [ ] **Step 1: Update DTO imports** (lines 14-18) to add the reorder schema:

```ts
import { CreateHabitDto, UpdateHabitDto, ReorderHabitsDto } from "./habit.dto";
import {
  CreateHabitDto as CreateSchema,
  UpdateHabitDto as UpdateSchema,
  ReorderHabitsDto as ReorderSchema,
} from "./habit.dto";
```

- [ ] **Step 2: Add `archivedOnly` handling to `list`** (`habit.controller.ts:35-56`) — replace the method body's first branch area so the final method reads:

```ts
  @Get()
  async list(
    @Req() req: StageholderRequest,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("updatedSince") updatedSince?: string,
    @Query("includeSoftDeleted") includeSoftDeleted?: string,
    @Query("archivedOnly") archivedOnly?: string,
  ) {
    if (updatedSince) {
      return this.service.findUpdatedSince(
        req.user.sub,
        updatedSince,
        includeSoftDeleted === "true",
      );
    }
    if (archivedOnly === "true") {
      return this.service.listArchived(req.user.sub);
    }
    return this.service.listByUser(
      req.user.sub,
      page ? +page : undefined,
      limit ? +limit : undefined,
    );
  }
```

- [ ] **Step 3: Add reorder + archive routes.** Insert BEFORE the `@Get(":id")` handler (line 58), so the static paths win over the `:id` param route:

```ts
  @Post("reorder")
  async reorder(
    @Req() req: StageholderRequest,
    @Body(new ZodValidationPipe(ReorderSchema)) dto: ReorderHabitsDto,
  ) {
    await this.service.reorder(req.user.sub, dto);
    return { reordered: true };
  }

  @Post(":id/archive")
  async archive(@Req() req: StageholderRequest, @Param("id") id: string) {
    return (await this.service.archive(req.user.sub, id)).toObject();
  }

  @Post(":id/unarchive")
  async unarchive(@Req() req: StageholderRequest, @Param("id") id: string) {
    return (await this.service.unarchive(req.user.sub, id)).toObject();
  }
```

**Commit (user):** the modified file.

### Task 1.12: Register `HabitGroupModule` + entitlement key

**Files:**

- Modify: the module that imports `TodoListModule` (find it: `grep -rn "TodoListModule" apps/api/src/*.module.ts apps/api/src/**/*.module.ts`)
- Modify: the entitlement defaults (find it: `grep -rn "max_todo_lists" apps/api/src`)

- [ ] **Step 1: Find the app module wiring**

Run: `grep -rn "TodoListModule" apps/api/src --include=*.ts`
Expected: an `imports: [...]` array (likely `app.module.ts`). Add `HabitGroupModule` next to `HabitModule`/`TodoListModule`:

```ts
import { HabitGroupModule } from "./modules/habit-group/habit-group.module";
// ...in imports: [...]
  HabitGroupModule,
```

- [ ] **Step 2: Add the `max_habit_groups` entitlement default**

Run: `grep -rn "max_todo_lists" apps/api/src`
Read the file(s) it lives in (entitlement defaults / plan config). Add a `max_habit_groups` entry mirroring `max_todo_lists`' default value for each plan tier. If `enforceLimit` reads from the Hub user claim and tolerates a missing key (treats absent as unlimited or a fallback), confirm by reading `apps/api/src/common/helpers/entitlement.ts` — if a missing key throws, you MUST add the default. Document the chosen limit in the commit message.

- [ ] **Step 3: Manual verification (the backend acceptance pass)** — user runs the API and exercises:

```
# seed: first call returns 4 groups (Morning/Afternoon/Evening/Anytime)
GET  /habit-groups
POST /habit-groups            {"name":"Health","color":"#22c55e"}
POST /habit-groups/reorder    {"items":[{"id":"<health>","order":0}]}
POST /habits                  {"name":"Read","targetCount":1,"groupId":"<health>"}
POST /habits/reorder          {"items":[{"id":"<read>","order":1,"groupId":"<morning>"}]}
POST /habits/<read>/archive   → archived_at set; GET /habits no longer lists it
GET  /habits?archivedOnly=true → lists it
POST /habits/<read>/unarchive → back in GET /habits
DELETE /habit-groups/<morning> → Read's group_id becomes null (Ungrouped), Read still exists
GET  /habit-groups (after deleting all 4 seeds) → does NOT re-seed
```

**Commit (user):** the app module + entitlement files.

---

# PHASE 2 — Shared core (`@repo/core`)

### Task 2.1: Types — `HabitGroup` + new `Habit` fields

**Files:**

- Modify: `packages/core/src/types/habit.ts`

- [ ] **Step 1: Add the new `Habit` fields** (after `icon?`, line 12):

```ts
  groupId?: string | null;
  order: number;
  archivedAt?: string | null;
```

- [ ] **Step 2: Add the `HabitGroup` interface** at the top of the file (above `Habit`):

```ts
export interface HabitGroup {
  id: string;
  userSub: string;
  name: string;
  color?: string;
  icon?: string;
  order: number;
  creatorId?: string;
  createdAt: string;
  updatedAt: string;
}
```

> Verify `HabitGroup` is re-exported by the package barrel. Run: `grep -rn "habit" packages/core/src/types/index.ts` — if the barrel does `export * from "./habit"`, no change needed; otherwise add `HabitGroup` to the explicit export list.

**Commit (user):** the modified file (+ barrel if touched).

### Task 2.2: API factory — group CRUD/reorder, habit reorder/archive

**Files:**

- Modify: `packages/core/src/api/habits.ts`

- [ ] **Step 1: Import `HabitGroup`** (line 2):

```ts
import type { Habit, HabitEntry, HabitGroup } from "@repo/core/types";
```

- [ ] **Step 2: Add `groupId` to the `create` payload type** (inside `create`, after `icon?: string;` ~line 20):

```ts
      groupId?: string | null;
```

- [ ] **Step 3: Add `groupId` to the `update` payload type** (inside `update`, after `icon?: string;` ~line 44):

```ts
      groupId?: string | null;
```

- [ ] **Step 4: Add the new methods.** Insert after `delete` (line 52), before `// Habit Entries`:

```ts
    // Reorder habits (within a group) and/or move between groups. Mirrors
    // `reorderTodos`: an array of {id, order, groupId?} so the server applies a
    // sparse update; including groupId moves the habit in the same call.
    reorder: async (data: {
      items: { id: string; order: number; groupId?: string | null }[];
    }): Promise<void> => {
      await client.post(`/habits/reorder`, data);
    },
    archive: async (id: string): Promise<Habit> => {
      const res = await client.post(`/habits/${id}/archive`, {});
      return res.data;
    },
    unarchive: async (id: string): Promise<Habit> => {
      const res = await client.post(`/habits/${id}/unarchive`, {});
      return res.data;
    },

    // Habit Groups
    createGroup: async (data: {
      name: string;
      color?: string;
      icon?: string;
    }): Promise<HabitGroup> => {
      const res = await client.post(`/habit-groups`, data);
      return res.data;
    },
    listGroups: async (
      params?: Record<string, string>,
    ): Promise<HabitGroup[]> => {
      const res = await client.get(`/habit-groups`, { params });
      return res.data?.data ?? res.data;
    },
    getGroup: async (groupId: string): Promise<HabitGroup> => {
      const res = await client.get(`/habit-groups/${groupId}`);
      return res.data;
    },
    updateGroup: async (
      groupId: string,
      data: { name?: string; color?: string; icon?: string },
    ): Promise<HabitGroup> => {
      const res = await client.patch(`/habit-groups/${groupId}`, data);
      return res.data;
    },
    deleteGroup: async (groupId: string): Promise<void> => {
      await client.delete(`/habit-groups/${groupId}`);
    },
    reorderGroups: async (data: {
      items: { id: string; order: number }[];
    }): Promise<void> => {
      await client.post(`/habit-groups/reorder`, data);
    },
```

**Manual verification:** none (consumed by Phase 4/5).
**Commit (user):** the modified file.

### Task 2.3: Ring math — exclude archived (belt-and-suspenders)

The default `useHabits()` already excludes archived server-side (Task 1.8). This guards the pure helper for any caller that passes a mixed list.

**Files:**

- Modify: `packages/core/src/habits/entry-resolution.ts`

- [ ] **Step 1: Filter archived in `countScheduledHabitsForDate`** (`entry-resolution.ts:59-65`) — add the archived guard as the first predicate:

```ts
return habits.filter((h) => {
  if (h.archivedAt) return false;
  if (h.frequency === "weekly_target") return false;
  const createdDate = h.createdAt?.slice(0, 10);
  if (createdDate && createdDate > date) return false;
  if (!h.scheduledDays || h.scheduledDays.length === 0) return true;
  return h.scheduledDays.includes(dow);
}).length;
```

> `h.archivedAt` is now on the `Habit` type (Task 2.1). The `Habit[]` param already carries it.

**Manual verification:** none (verified via the PWA rings after Phase 4).
**Commit (user):** the modified file.

---

# PHASE 3 — Shared features (`@repo/features`)

### Task 3.1: `HabitGroupForm` (cross-platform)

A near-exact copy of `TodoListForm` (`packages/features/src/todos/todo-list-form.tsx`) — same controlled name + color-swatch pattern, same `key`-remount reset semantics, same worklets-safe `swatch` destructuring.

**Files:**

- Create: `packages/features/src/habits/habit-group-form.tsx`
- Modify: `packages/features/src/habits/index.ts`

- [ ] **Step 1: Write the form**

```tsx
import { useState } from "react";
import { Form } from "tamagui";
import {
  Button,
  Input,
  Label,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";

/** Cross-platform create/edit-group form values. */
export interface HabitGroupFormValues {
  name: string;
  color: string;
}

/** Default seed for a brand-new group (create flow). */
export const HABIT_GROUP_FORM_DEFAULTS: HabitGroupFormValues = {
  name: "",
  color: "#3b82f6",
};

/** Swatch palette — mirrors the todo-list form so the two read identically. */
export const HABIT_GROUP_COLOR_OPTIONS = [
  { value: "#ef4444", label: "Red" },
  { value: "#f97316", label: "Orange" },
  { value: "#eab308", label: "Yellow" },
  { value: "#22c55e", label: "Green" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#ec4899", label: "Pink" },
  { value: "#6b7280", label: "Gray" },
];

export interface HabitGroupFormProps {
  initial: HabitGroupFormValues;
  submitLabel: string;
  submittingLabel: string;
  isSubmitting?: boolean;
  onSubmit: (values: HabitGroupFormValues) => void | Promise<void>;
  onCancel: () => void;
}

/**
 * Cross-platform create/edit group form — shared by the PWA dialog and the
 * mobile sheet. Pure presentational + controlled; the host owns the chrome
 * and the create/update mutation. Re-mount via `key` for reset semantics.
 */
export function HabitGroupForm({
  initial,
  submitLabel,
  submittingLabel,
  isSubmitting,
  onSubmit,
  onCancel,
}: HabitGroupFormProps) {
  const [name, setName] = useState(initial.name);
  const [color, setColor] = useState(initial.color);

  function handleSubmit() {
    if (!name.trim()) return;
    void onSubmit({ name: name.trim(), color });
  }

  return (
    <Form onSubmit={handleSubmit} width="100%">
      <YStack gap="$4">
        <YStack gap="$1">
          <Label htmlFor="habit-group-form-name">Name</Label>
          <Input
            id="habit-group-form-name"
            value={name}
            onChangeText={setName}
            placeholder="My Group"
            autoFocus
          />
        </YStack>

        <YStack gap="$2">
          <Text fontSize="$3" fontWeight="500" color="$color">
            Color
          </Text>
          <XStack gap="$2">
            {/* Destructure to a bare `swatch` — the color must NOT reach the
                JSX `style` as a `.value` MEMBER (worklets babel false-positive). */}
            {HABIT_GROUP_COLOR_OPTIONS.map(({ value: swatch, label }) => (
              <View
                key={swatch}
                onPress={() => setColor(swatch)}
                cursor="pointer"
                width={28}
                height={28}
                rounded={9999}
                borderWidth={2}
                transition="quick"
                borderColor={color === swatch ? "$color" : "transparent"}
                scale={color === swatch ? 1.1 : 1}
                style={{ backgroundColor: swatch }}
                aria-label={label}
                aria-pressed={color === swatch}
                role="button"
              />
            ))}
          </XStack>
        </YStack>

        <XStack gap="$3" pt="$2" $md={{ justify: "flex-end" }}>
          <Button
            intent="outline"
            type="button"
            flex={1}
            $md={{ flexBasis: "auto", grow: 0 }}
            onPress={onCancel}
          >
            Cancel
          </Button>
          <Form.Trigger asChild>
            <Button
              flex={1}
              $md={{ flexBasis: "auto", grow: 0 }}
              disabled={!name.trim() || isSubmitting}
              loading={isSubmitting}
              loadingText={submittingLabel}
            >
              {submitLabel}
            </Button>
          </Form.Trigger>
        </XStack>
      </YStack>
    </Form>
  );
}
```

- [ ] **Step 2: Export it** — read `packages/features/src/habits/index.ts`, then add:

```ts
export * from "./habit-group-form";
```

**Manual verification:** none yet.
**Commit (user):** the new file + barrel.

### Task 3.2: `HabitCard` — Archive/Unarchive + Move-to-group menu, drag affordance

`HabitCard` (`packages/features/src/habits/habit-card.tsx`, ~796 lines) is presentation-only; hosts wire mutations. **Read it first**, locate its props interface and its menu (it already has Edit/Delete actions — the report cites Undo/Clear-status/Skip/Fail/Edit/Delete in a kebab/DropdownMenu).

**Files:**

- Modify: `packages/features/src/habits/habit-card.tsx`

- [ ] **Step 1: Add optional props** to the card's props interface (alongside `onEdit`, `onDelete`):

```ts
  /** Present → show "Archive"/"Unarchive" in the menu. Host wires the mutation. */
  onArchive?: () => void;
  onUnarchive?: () => void;
  /** Whether this habit is archived (drives the menu label + restore affordance). */
  isArchived?: boolean;
  /** Present → show "Move to group…" in the menu. Host opens the picker. */
  onMoveToGroup?: () => void;
```

- [ ] **Step 2: Add the menu items.** In the same DropdownMenu/menu block that renders Edit + Delete, add (mirroring the existing item markup — match its component, e.g. `DropdownMenu.Item` or kit `Menu.Item`):

```tsx
{
  onMoveToGroup ? (
    <DropdownMenu.Item key="move" onSelect={onMoveToGroup}>
      {/* match the icon idiom used by the sibling items */}
      <DropdownMenu.ItemTitle>Move to group…</DropdownMenu.ItemTitle>
    </DropdownMenu.Item>
  ) : null;
}
{
  isArchived && onUnarchive ? (
    <DropdownMenu.Item key="unarchive" onSelect={onUnarchive}>
      <DropdownMenu.ItemTitle>Unarchive</DropdownMenu.ItemTitle>
    </DropdownMenu.Item>
  ) : null;
}
{
  !isArchived && onArchive ? (
    <DropdownMenu.Item key="archive" onSelect={onArchive}>
      <DropdownMenu.ItemTitle>Archive</DropdownMenu.ItemTitle>
    </DropdownMenu.Item>
  ) : null;
}
```

> Use the EXACT menu primitive + item sub-components the file already imports — do not introduce a new menu library. If the file uses kit `DropdownMenu` with `onSelect`, keep that; if it uses `onPress`, match that. The three props are all optional, so existing call sites are unaffected.

**Manual verification:** existing habit cards still render with their current menu (no new items where the host passes no handlers).
**Commit (user):** the modified file.

---

# PHASE 4 — PWA

### Task 4.1: Group hooks

**Files:**

- Create: `apps/pwa/src/lib/api/habit-groups.ts`

- [ ] **Step 1: Confirm the shared client exposes the new methods.** Read `apps/pwa/src/lib/api/clients.ts` — `habitsApi` is `createHabitsApi(client)` so it already has `createGroup/listGroups/...` from Task 2.2. No change needed (verify only).

- [ ] **Step 2: Write the group hooks** (mirror the todo-list hooks pattern + `useHabits` invalidation style)

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { HabitGroup } from "@repo/core/types";
import { habitsApi } from "./clients";

export const habitGroupKeys = {
  all: ["habitGroups"] as const,
};

export function useHabitGroups() {
  return useQuery<HabitGroup[]>({
    queryKey: habitGroupKeys.all,
    queryFn: () => habitsApi.listGroups(),
  });
}

export function useCreateHabitGroup() {
  const qc = useQueryClient();
  return useMutation<
    HabitGroup,
    Error,
    { name: string; color?: string; icon?: string }
  >({
    mutationFn: (data) => habitsApi.createGroup(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: habitGroupKeys.all });
    },
  });
}

export function useUpdateHabitGroup() {
  const qc = useQueryClient();
  return useMutation<
    HabitGroup,
    Error,
    { id: string; data: { name?: string; color?: string; icon?: string } }
  >({
    mutationFn: ({ id, data }) => habitsApi.updateGroup(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: habitGroupKeys.all });
    },
  });
}

export function useDeleteHabitGroup() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => habitsApi.deleteGroup(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: habitGroupKeys.all });
      // Deleting a group orphans its habits → refresh the habit list too.
      void qc.invalidateQueries({ queryKey: ["habits"] });
    },
  });
}

export function useReorderHabitGroups() {
  const qc = useQueryClient();
  return useMutation<void, Error, { items: { id: string; order: number }[] }>({
    mutationFn: (data) => habitsApi.reorderGroups(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: habitGroupKeys.all });
    },
  });
}
```

**Commit (user):** the new file.

### Task 4.2: Habit reorder / archive / unarchive hooks + group move

**Files:**

- Modify: `apps/pwa/src/lib/api/habits.ts`

- [ ] **Step 1: Append the new mutations** at the end of the file (the existing `useUpdateHabit` already covers group moves via `data.groupId`, but add explicit helpers for clarity):

```ts
export function useReorderHabits() {
  const queryClient = useQueryClient();
  return useMutation<
    void,
    Error,
    { items: { id: string; order: number; groupId?: string | null }[] }
  >({
    mutationFn: (data) => habitsApi.reorder(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["habits"] });
    },
  });
}

export function useArchiveHabit() {
  const queryClient = useQueryClient();
  return useMutation<Habit, Error, string>({
    mutationFn: (id) => habitsApi.archive(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["habits"] });
      void queryClient.invalidateQueries({ queryKey: ["habitsArchived"] });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

export function useUnarchiveHabit() {
  const queryClient = useQueryClient();
  return useMutation<Habit, Error, string>({
    mutationFn: (id) => habitsApi.unarchive(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["habits"] });
      void queryClient.invalidateQueries({ queryKey: ["habitsArchived"] });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

export function useArchivedHabits() {
  return useQuery<Habit[]>({
    queryKey: ["habitsArchived"],
    queryFn: () => habitsApi.list({ archivedOnly: "true" }),
  });
}
```

> `habitsApi.list` accepts `Record<string,string>` params (confirmed `api/habits.ts:25`) so `{ archivedOnly: "true" }` flows through as the query string.

**Commit (user):** the modified file.

### Task 4.3: Group create/edit dialog

**Files:**

- Create: `apps/pwa/src/components/habits/habit-group-dialog.tsx`

- [ ] **Step 1: Write the dialog** (mirror the existing `create-list-dialog.tsx` shape — Dialog hosting the shared form. Read `apps/pwa/src/components/todos/create-list-dialog.tsx` first to match its Dialog idiom; the code below uses the kit `Dialog` compound.)

```tsx
import {
  HabitGroupForm,
  HABIT_GROUP_FORM_DEFAULTS,
  type HabitGroupFormValues,
} from "@repo/features/habits";
import { Dialog } from "@stageholder/ui";
import type { HabitGroup } from "@repo/core/types";
import {
  useCreateHabitGroup,
  useUpdateHabitGroup,
} from "@/lib/api/habit-groups";

interface HabitGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog edits this group; otherwise it creates. */
  group?: HabitGroup | null;
}

export function HabitGroupDialog({
  open,
  onOpenChange,
  group,
}: HabitGroupDialogProps) {
  const create = useCreateHabitGroup();
  const update = useUpdateHabitGroup();
  const isEdit = !!group;
  const initial: HabitGroupFormValues = group
    ? {
        name: group.name,
        color: group.color ?? HABIT_GROUP_FORM_DEFAULTS.color,
      }
    : HABIT_GROUP_FORM_DEFAULTS;

  async function handleSubmit(values: HabitGroupFormValues) {
    if (isEdit && group) {
      await update.mutateAsync({ id: group.id, data: values });
    } else {
      await create.mutateAsync(values);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <Dialog.Title>{isEdit ? "Edit group" : "New group"}</Dialog.Title>
          {/* key remounts the controlled form when the target group changes */}
          <HabitGroupForm
            key={group?.id ?? "create"}
            initial={initial}
            submitLabel={isEdit ? "Save" : "Create"}
            submittingLabel={isEdit ? "Saving…" : "Creating…"}
            isSubmitting={create.isPending || update.isPending}
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
```

> Match the exact `Dialog` sub-component usage in `create-list-dialog.tsx` (it may use `DialogSheetAdapt` for mobile). Mirror whatever that file does so the create/edit-group dialog adapts to a sheet on small screens identically.

**Commit (user):** the new file.

### Task 4.4: Habits sidebar (kit `Sidebar`)

**Files:**

- Create: `apps/pwa/src/components/habits/habits-sidebar.tsx`

Read `apps/pwa/src/components/todos/todo-list-sidebar.tsx` (the pattern reference) and the kit `Sidebar` API (`Sidebar.Provider/Content/Group/Menu/MenuItem/MenuButton`, `glyph`, `badge`, `isActive`, `href`).

- [ ] **Step 1: Write the sidebar** — "All habits", group rows (count badge, kebab edit/delete), "+ Create group", "Archived". Group rows are wrapped in kit `Sortable` for drag-reorder.

```tsx
import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Sidebar,
  Sortable,
  reorderItems,
  Button,
  DropdownMenu,
  View,
  XStack,
} from "@stageholder/ui";
import { Plus, Archive, Target, MoreVertical } from "lucide-react";
import type { HabitGroup, Habit } from "@repo/core/types";
import { useHabits } from "@/lib/api/habits";
import {
  useHabitGroups,
  useReorderHabitGroups,
  useDeleteHabitGroup,
} from "@/lib/api/habit-groups";
import { HabitGroupDialog } from "./habit-group-dialog";

interface HabitsSidebarProps {
  /** undefined = "All habits" active; otherwise the active groupId. */
  activeGroupId?: string;
}

export function HabitsSidebar({ activeGroupId }: HabitsSidebarProps) {
  const navigate = useNavigate();
  const { data: groups } = useHabitGroups();
  const { data: habits } = useHabits();
  const reorderGroups = useReorderHabitGroups();
  const deleteGroup = useDeleteHabitGroup();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<HabitGroup | null>(null);

  // Per-group active-habit count for the badge (archived already excluded by
  // the server, so `habits` is the active set).
  const countByGroup = useMemo(() => {
    const m = new Map<string | null, number>();
    for (const h of (habits ?? []) as Habit[]) {
      const k = h.groupId ?? null;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [habits]);

  const ordered = useMemo(
    () => [...(groups ?? [])].sort((a, b) => a.order - b.order),
    [groups],
  );

  function handleReorder(from: number, to: number) {
    const next = reorderItems(ordered, from, to);
    reorderGroups.mutate({
      items: next.map((g, i) => ({ id: g.id, order: i })),
    });
  }

  return (
    <Sidebar.Provider defaultOpen collapsible="icon">
      <Sidebar>
        <Sidebar.Content>
          <Sidebar.Group>
            <Sidebar.Menu>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton
                  glyph={Target}
                  isActive={!activeGroupId}
                  onPress={() => navigate({ to: "/habits" })}
                >
                  All habits
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
            </Sidebar.Menu>
          </Sidebar.Group>

          <Sidebar.Group>
            <Sidebar.GroupLabel>Groups</Sidebar.GroupLabel>
            <Sortable
              items={ordered}
              keyExtractor={(g) => g.id}
              onReorder={handleReorder}
              renderItem={(g) => (
                <XStack items="center" gap="$1">
                  <Sidebar.MenuButton
                    glyph={() => (
                      <View
                        width={10}
                        height={10}
                        rounded={9999}
                        style={{ backgroundColor: g.color ?? "#6b7280" }}
                      />
                    )}
                    flex={1}
                    badge={countByGroup.get(g.id) ?? 0}
                    isActive={activeGroupId === g.id}
                    onPress={() =>
                      navigate({
                        to: "/habits/$groupId",
                        params: { groupId: g.id },
                      })
                    }
                  >
                    {g.name}
                  </Sidebar.MenuButton>
                  <DropdownMenu>
                    <DropdownMenu.Trigger asChild>
                      <Button
                        intent="ghost"
                        size="sm"
                        icon={<MoreVertical size={16} />}
                      />
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content>
                      <DropdownMenu.Item
                        onSelect={() => {
                          setEditing(g);
                          setDialogOpen(true);
                        }}
                      >
                        <DropdownMenu.ItemTitle>Edit</DropdownMenu.ItemTitle>
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        onSelect={() => deleteGroup.mutate(g.id)}
                      >
                        <DropdownMenu.ItemTitle>Delete</DropdownMenu.ItemTitle>
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu>
                </XStack>
              )}
            />
            <Sidebar.Menu>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton
                  glyph={Plus}
                  onPress={() => {
                    setEditing(null);
                    setDialogOpen(true);
                  }}
                >
                  Create group
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
            </Sidebar.Menu>
          </Sidebar.Group>

          <Sidebar.Group>
            <Sidebar.Menu>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton
                  glyph={Archive}
                  isActive={activeGroupId === "__archived__"}
                  onPress={() => navigate({ to: "/habits/archived" })}
                >
                  Archived
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
            </Sidebar.Menu>
          </Sidebar.Group>
        </Sidebar.Content>
      </Sidebar>

      <HabitGroupDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        group={editing}
      />
    </Sidebar.Provider>
  );
}
```

> **Verify the exact kit API at execution.** The explorer reported `Sidebar.MenuButton` supports `glyph`/`badge`/`isActive`/`onPress`/`href` and that `Sortable` exposes `items/renderItem/onReorder/keyExtractor` + the `reorderItems` helper. If a prop name differs in the installed dist, adjust to the real signature (read `node_modules/@stageholder/ui/types/.../Sidebar.d.ts` + `Sortable.types.d.ts`). Do NOT hand-roll drag or sidebar chrome.

**Commit (user):** the new file.

### Task 4.5: Mount the sidebar + section the index route by group

**Files:**

- Modify: `apps/pwa/src/routes/_app/habits/index.tsx`
- (Possibly) Create: `apps/pwa/src/routes/_app/habits/route.tsx` (layout wrapper hosting the sidebar across all `/habits/*` routes)

- [ ] **Step 1: Decide where the sidebar lives.** Read `apps/pwa/src/routes/_app/route.tsx` and how todos mounts `todo-list-sidebar` (route layout vs in-page). Mirror todos: if todos uses a `routes/_app/todos/route.tsx` layout with `<Outlet/>` beside the sidebar, create the analogous `routes/_app/habits/route.tsx`:

```tsx
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { XStack } from "@stageholder/ui";
import { HabitsSidebar } from "@/components/habits/habits-sidebar";

export const Route = createFileRoute("/_app/habits")({
  component: HabitsLayout,
});

function HabitsLayout() {
  return (
    <XStack flex={1}>
      <HabitsSidebar />
      <Outlet />
    </XStack>
  );
}
```

> Match todos' actual layout approach. If todos renders the sidebar INSIDE the index page rather than a route layout, do the same for habits instead of creating `route.tsx`.

- [ ] **Step 2: Section the index by group + drag.** In `routes/_app/habits/index.tsx`, replace the flat `habits.map(...)` card/list rendering (lines 202-241) with a per-group sectioned render. Add imports and a grouping memo:

```tsx
import { useHabitGroups } from "@/lib/api/habit-groups";
import { useReorderHabits } from "@/lib/api/habits";
import { Sortable, reorderItems, Text } from "@stageholder/ui";
```

Build the sections (place above the `return`, after `const { data: habits } = useHabits()`):

```tsx
const { data: groups } = useHabitGroups();
const reorderHabits = useReorderHabits();

// Build ordered sections: each real group (by order) then "Ungrouped" last.
const sections = useMemo(() => {
  const byGroup = new Map<string | null, Habit[]>();
  for (const h of (habits ?? []) as Habit[]) {
    const k = h.groupId ?? null;
    const arr = byGroup.get(k) ?? [];
    arr.push(h);
    byGroup.set(k, arr);
  }
  for (const arr of byGroup.values()) arr.sort((a, b) => a.order - b.order);
  const ordered = [...(groups ?? [])].sort((a, b) => a.order - b.order);
  const result: { id: string | null; name: string; habits: Habit[] }[] = [];
  for (const g of ordered) {
    result.push({ id: g.id, name: g.name, habits: byGroup.get(g.id) ?? [] });
  }
  const ungrouped = byGroup.get(null) ?? [];
  if (ungrouped.length) {
    result.push({ id: null, name: "Ungrouped", habits: ungrouped });
  }
  return result;
}, [habits, groups]);

function handleSectionReorder(
  groupId: string | null,
  list: Habit[],
  from: number,
  to: number,
) {
  const next = reorderItems(list, from, to);
  reorderHabits.mutate({
    items: next.map((h, i) => ({ id: h.id, order: i, groupId })),
  });
}
```

Then render sections in place of the flat map (card view shown; keep the list-view branch analogous):

```tsx
<YStack gap="$6">
  {sections.map((section) => (
    <YStack key={section.id ?? "ungrouped"} gap="$3">
      <Text fontSize="$5" fontWeight="600" color="$color">
        {section.name}
      </Text>
      <Sortable
        items={section.habits}
        keyExtractor={(h) => h.id}
        onReorder={(from, to) =>
          handleSectionReorder(section.id, section.habits, from, to)
        }
        renderItem={(habit) => (
          <View width="100%" $md={{ width: "49%" }} $lg={{ width: "32%" }}>
            <HabitCard
              habit={habit}
              flex={1}
              minW={0}
              selectedDate={isViewingToday ? undefined : selectedDate}
              onArchive={undefined /* wired in 4.6 */}
              onMoveToGroup={undefined /* wired in 4.6 */}
            />
          </View>
        )}
      />
    </YStack>
  ))}
</YStack>
```

> Keep the existing loading skeleton + EmptyState branches untouched. The card-wrapping `<View>` width strategy is preserved verbatim from the original (lines 210-224). If `Sortable`'s layout doesn't flow children in a wrapping grid, wrap each section's `Sortable` so it lays out vertically (the kit `Sortable` is a vertical list) — for the responsive card grid, use list-mode within a group OR accept single-column drag per section. Confirm the visual against the kit `Sortable` demo and choose the simpler of: (a) vertical single-column cards per section (drag-friendly), or (b) keep the wrap grid in card view but only enable drag in list view. **Recommended:** vertical `Sortable` of `HabitCard`s per section in BOTH views — simpler and drag-consistent. Log this choice in the PR description.

**Manual verification (user):** sidebar shows the 4 seeded groups + counts; selecting a group filters; dragging a group reorders and persists on reload; dragging a habit within a section reorders and persists.
**Commit (user):** the route files.

### Task 4.6: Wire archive + move-to-group on the card; group form picker; `$groupId` + `archived` routes

**Files:**

- Modify: `apps/pwa/src/routes/_app/habits/index.tsx` (wire card handlers)
- Modify: `apps/pwa/src/components/habits/habit-form.tsx` (group `Select`)
- Create: `apps/pwa/src/routes/_app/habits/$groupId.tsx`
- Create: `apps/pwa/src/routes/_app/habits/archived.tsx`

- [ ] **Step 1: Wire the card menu handlers** in `index.tsx`'s `renderItem` — replace the `undefined` placeholders from Task 4.5:

```tsx
import { useArchiveHabit, useUpdateHabit } from "@/lib/api/habits";
// ...inside HabitsPage:
const archiveHabit = useArchiveHabit();
const updateHabit = useUpdateHabit();
const [movingHabit, setMovingHabit] = useState<Habit | null>(null);
// ...renderItem props:
onArchive={() => archiveHabit.mutate(habit.id)}
onMoveToGroup={() => setMovingHabit(habit)}
```

Add a lightweight "Move to group" picker dialog at the bottom of `HabitsPage` (kit `Dialog` listing groups + "Ungrouped"; on select → `updateHabit.mutate({ id: movingHabit.id, data: { groupId: chosenIdOrNull } })` then clear). Mirror the `HabitGroupDialog` structure; group options come from `useHabitGroups()`.

- [ ] **Step 2: Add a group `Select` to `habit-form.tsx`.** Read it first (it shares `HabitForm` from `@repo/features` via a host wrapper — confirm whether the group field belongs in the shared `@repo/features/habits/habit-form.tsx` or the PWA host). Add an OPTIONAL `groupId` to `HabitFormValues` + an optional `groups` prop; render a kit `Select` only when `groups.length > 0` (mirror `TodoForm`'s hidden-when-≤1 list selector). The host passes `useHabitGroups()` data and threads `groupId` into the create/update mutation. Default new-habit `groupId` to the currently-active sidebar group when creating from a group view.

- [ ] **Step 3: `$groupId` route** — single-group view (one `Sortable`, reuses the section render for one group):

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  YStack,
  Text,
  Sortable,
  reorderItems,
  View,
  EmptyState,
} from "@stageholder/ui";
import { useHabits, useReorderHabits } from "@/lib/api/habits";
import { useHabitGroups } from "@/lib/api/habit-groups";
import { HabitCard } from "@/components/habits/habit-card";
import type { Habit } from "@repo/core/types";

export const Route = createFileRoute("/_app/habits/$groupId")({
  component: GroupView,
});

function GroupView() {
  const { groupId } = Route.useParams();
  const { data: habits } = useHabits();
  const { data: groups } = useHabitGroups();
  const reorder = useReorderHabits();
  const group = groups?.find((g) => g.id === groupId);
  const list = useMemo(
    () =>
      ((habits ?? []) as Habit[])
        .filter((h) => (h.groupId ?? null) === groupId)
        .sort((a, b) => a.order - b.order),
    [habits, groupId],
  );

  return (
    <YStack gap="$4" p="$4" flex={1}>
      <Text fontSize="$7" fontWeight="700">
        {group?.name ?? "Group"}
      </Text>
      {list.length === 0 ? (
        <EmptyState>
          <EmptyState.Title>No habits in this group</EmptyState.Title>
        </EmptyState>
      ) : (
        <Sortable
          items={list}
          keyExtractor={(h) => h.id}
          onReorder={(from, to) => {
            const next = reorderItems(list, from, to);
            reorder.mutate({
              items: next.map((h, i) => ({ id: h.id, order: i, groupId })),
            });
          }}
          renderItem={(habit) => (
            <View width="100%">
              <HabitCard habit={habit} flex={1} minW={0} />
            </View>
          )}
        />
      )}
    </YStack>
  );
}
```

- [ ] **Step 4: `archived` route** — kit `List` of archived habits with Restore:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { YStack, Text, List, Button, EmptyState } from "@stageholder/ui";
import { useArchivedHabits, useUnarchiveHabit } from "@/lib/api/habits";

export const Route = createFileRoute("/_app/habits/archived")({
  component: ArchivedView,
});

function ArchivedView() {
  const { data: archived, isLoading } = useArchivedHabits();
  const unarchive = useUnarchiveHabit();

  return (
    <YStack gap="$4" p="$4" flex={1}>
      <Text fontSize="$7" fontWeight="700">
        Archived
      </Text>
      {!isLoading && (archived?.length ?? 0) === 0 ? (
        <EmptyState>
          <EmptyState.Title>Nothing archived</EmptyState.Title>
          <EmptyState.Description>
            Archived habits keep their full history and can be restored anytime.
          </EmptyState.Description>
        </EmptyState>
      ) : (
        <List loading={isLoading} loadingRows={3}>
          {(archived ?? []).map((h) => (
            <List.Item key={h.id}>
              <List.Group>
                <List.Title>{h.name}</List.Title>
                {h.description ? (
                  <List.Description>{h.description}</List.Description>
                ) : null}
              </List.Group>
              <Button
                intent="secondary"
                size="sm"
                onPress={() => unarchive.mutate(h.id)}
              >
                Restore
              </Button>
            </List.Item>
          ))}
        </List>
      )}
    </YStack>
  );
}
```

**Manual verification (user):** create/rename/recolor/delete groups (delete → habits fall to Ungrouped, still present); assign via form Select; Move-to-group from the card menu; Archive a habit → leaves the list, rings unaffected, shows under Archived; Restore returns it; `$groupId` and `archived` routes render. Pre-existing habits appear under Ungrouped.
**Commit (user):** all four files.

---

# PHASE 5 — Mobile

### Task 5.1: Bump persisted-cache buster

The cached `Habit` shape now carries `groupId/order/archivedAt`. Per project memory, bump `buster` so devices drop the stale-shaped entries instead of rehydrating + crashing.

**Files:**

- Modify: `apps/mobile/lib/api/Provider.tsx`

- [ ] **Step 1:** Read the file, find `buster: "v2"` (per memory), bump to `"v3"`.

**Commit (user):** the modified file.

### Task 5.2: Mobile group + reorder/archive hooks

**Files:**

- Create: `apps/mobile/lib/api/hooks/habit-groups.ts`
- Modify: `apps/mobile/lib/api/hooks/habits.ts`
- Modify: `apps/mobile/lib/api/index.ts` (export the new hooks — verify the barrel pattern first)

- [ ] **Step 1:** Read `apps/mobile/lib/api/hooks/habits.ts` to learn its client accessor (it uses `@repo/core/api` factories per memory — find the `habitsApi`/client it calls). Mirror the PWA hooks from Tasks 4.1 + 4.2 against the mobile client. The group hooks file is identical to Task 4.1 except importing the mobile client accessor instead of `./clients`. Add `useReorderHabits`, `useArchiveHabit`, `useUnarchiveHabit`, `useArchivedHabits`, and the five group hooks.

- [ ] **Step 2:** Export them from the mobile api barrel (`apps/mobile/lib/api/index.ts`) following the existing export style.

**Commit (user):** the new + modified files.

### Task 5.3: Mobile group sheet

**Files:**

- Create: `apps/mobile/components/habit-group-sheet.tsx`

- [ ] **Step 1:** Read `apps/mobile/components/todo-list-sheet.tsx` (the native analog). Write `HabitGroupSheet` mirroring it: a driven kit `Sheet` (or `FormSheet`) hosting `HabitGroupForm` from `@repo/features/habits`, seeded per-open via `key`, closing on save. Follow the native sheet rules from memory: `transition="medium"` on the Sheet root, `snapPointsMode="constant"` with px snapPoints + `Sheet.ScrollView` (or `FormSheet` with `snapPointsMode="fit"`), `Banner.Body` if any banner, kit `Button` triggers, grabber `pt={0}`.

**Commit (user):** the new file.

### Task 5.4: Mobile habits screen — chips rail + sections + drag

**Files:**

- Modify: `apps/mobile/app/(authed)/habits.tsx`

- [ ] **Step 1: Add the chips rail** (mirror `apps/mobile/app/(authed)/todos.tsx` lines ~156-214). Read todos.tsx first. Add state `const [activeGroupId, setActiveGroupId] = useState<string | "__all__" | "__archived__">("__all__")` and a horizontal scrollable `XStack` of pills: "All" + each group (color dot + name) + pencil-edit when a group is active + "+ group" + "Archived". Wire `useHabitGroups()`.

- [ ] **Step 2: Section the list by group** — replace the flat `sorted.map(...)` (lines 159-166) with per-group sections (group header `Text` + a kit `Sortable` of `HabitCardRow`s), Ungrouped last; when `activeGroupId` is a real group, render only that section; when `__archived__`, render `useArchivedHabits()` rows with a Restore button (no drag, reuse a simple List/cards). Build the same `sections` memo as Task 4.5.

```tsx
import { Sortable, reorderItems } from "@stageholder/ui";
import { useHabitGroups } from "@/lib/api";
import { useReorderHabits } from "@/lib/api";
// ...
<Sortable
  items={section.habits}
  keyExtractor={(h) => h.id}
  onReorder={(from, to) => {
    const next = reorderItems(section.habits, from, to);
    reorderHabits.mutate({
      items: next.map((h, i) => ({ id: h.id, order: i, groupId: section.id })),
    });
  }}
  renderItem={(habit) => (
    <HabitCardRow
      habit={habit}
      onEdit={() => setEditingHabit(habit)}
      onOpenDetail={() => openDetail(habit)}
    />
  )}
/>;
```

> Kit `Sortable.native` uses long-press to activate so it coexists with the `PullToRefresh` scroller — verify drag works without fighting the scroll (the kit demo at `apps/docs-expo/app/components/sortable.tsx` is the reference).

- [ ] **Step 3: Wire card archive + move-to-group** in `HabitCardRow` — add `onArchive`/`onUnarchive`/`onMoveToGroup`/`isArchived` props and pass to `HabitCard`. `onArchive` → `useArchiveHabit().mutate(habit.id)`; `onMoveToGroup` → open a driven Sheet group-picker (reuse `HabitGroupSheet`'s sheet idiom or a simple Select-sheet) → `useUpdateHabit().mutate({ id, data: { groupId } })`.

- [ ] **Step 4: Mount `HabitGroupSheet`** (create/edit) driven by the chips-rail "+ group"/pencil, mirroring how todos mounts `TodoListSheet`.

**Manual verification (user, on a dev build — drag + sheets need native modules):** chips rail filters; section headers render; drag reorders within a group and persists; archive removes from list + leaves rings intact; Archived chip lists archived with Restore; group create/edit/delete via sheet; pre-existing habits under Ungrouped.
**Commit (user):** the modified file.

---

## Self-Review (against the spec)

**Spec coverage:**

- §1 data model → Tasks 1.1, 1.2, 1.7 (entity/schema/fields). ✅
- §2 backend API (group CRUD, seeding, orphan-delete, habit query params, reorder, archive) → Tasks 1.3–1.12. ✅
- §2.3 seeding-once guard → Task 1.6 `ensureSeed` + `countAllForUser` (Task 1.3). ✅
- §3 core types + api + ring exclusion → Tasks 2.1, 2.2, 2.3. ✅
- §4 features (HabitGroupForm, HabitCard menu) → Tasks 3.1, 3.2. ✅
- §5 PWA (sidebar, sectioned index, $groupId, archived, form picker) → Tasks 4.1–4.6. ✅
- §6 mobile (chips, sections, sheet, drag, buster) → Tasks 5.1–5.4. ✅
- §7.1 kit bump prereq → Task 0.1. ✅
- §7.3 entitlement key → Task 1.12 Step 2. ✅
- §7.5 updatedSince parity → group repo/service/controller include `findUpdatedSince` (Tasks 1.3, 1.6). ✅

**Type consistency:** `groupId: string | null` used consistently across entity, schema (`group_id`), DTO (`z.string().nullable().optional()`), core type, api payloads, and the reorder `{id, order, groupId?}` shape (backend `ReorderHabitsDto` + core `reorder` + hooks). `archivedAt` (camel) ↔ `archived_at` (mongo) ↔ `archive()`/`unarchive()` entity methods ↔ `/archive`/`/unarchive` routes ↔ `useArchiveHabit`/`useUnarchiveHabit`. `order` numeric everywhere. ✅

**Open items requiring execution-time confirmation (flagged inline, not placeholders):**

- Exact kit `Sidebar`/`Sortable` prop names — verify against installed `.d.ts` (Task 0.1 Step 5 + Task 4.4 note).
- `HabitCard` menu primitive (`DropdownMenu` vs kit `Menu`) — match the file (Task 3.2).
- App-module location + entitlement-default mechanism — discovered via `grep` (Task 1.12).
- Card-grid-vs-vertical-`Sortable` layout choice in card view — recommended vertical, logged in PR (Task 4.5).
