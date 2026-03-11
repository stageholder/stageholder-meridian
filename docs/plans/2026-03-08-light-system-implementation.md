# Light System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Meridian's gamification system where users earn "Light" through todos, habits, and journaling, leveling through 10 celestial tiers from Stargazer to Meridian.

**Architecture:** New `light` backend module following existing DDD patterns (Entity, Repository, Service, Controller). Frontend adds star visual inside activity rings, level progress bar on dashboard, and a dedicated "My Journey" page. Light is user-scoped (not workspace-scoped). Points are triggered from existing services via simple method calls.

**Tech Stack:** NestJS + MongoDB (backend), React + React Query + SVG (frontend), Zod (validation), shadcn/ui (UI components)

---

### Task 1: Light Config Constants

**Files:**

- Create: `apps/api/src/modules/light/domain/light-config.ts`

**Step 1: Create the config file with tier thresholds, point values, and multiplier rules**

```typescript
export const LIGHT_TIERS = [
  { tier: 1, title: "Stargazer", lightRequired: 0 },
  { tier: 2, title: "Spark", lightRequired: 50 },
  { tier: 3, title: "Ember", lightRequired: 150 },
  { tier: 4, title: "Flame", lightRequired: 400 },
  { tier: 5, title: "Radiant", lightRequired: 800 },
  { tier: 6, title: "Flare", lightRequired: 1500 },
  { tier: 7, title: "Nova", lightRequired: 2800 },
  { tier: 8, title: "Pulsar", lightRequired: 5000 },
  { tier: 9, title: "Supernova", lightRequired: 8500 },
  { tier: 10, title: "Meridian", lightRequired: 13000 },
] as const;

export type LightTier = (typeof LIGHT_TIERS)[number];

export const LIGHT_ACTIONS = {
  TODO_COMPLETE_LOW: 3,
  TODO_COMPLETE_MEDIUM: 4,
  TODO_COMPLETE_HIGH: 5,
  HABIT_CHECKIN: 4,
  JOURNAL_ENTRY: 6,
  PERFECT_DAY: 10,
} as const;

export const STREAK_MULTIPLIERS = [
  { minDays: 30, multiplier: 3.0 },
  { minDays: 14, multiplier: 2.5 },
  { minDays: 7, multiplier: 2.0 },
  { minDays: 3, multiplier: 1.5 },
  { minDays: 1, multiplier: 1.0 },
] as const;

export const RING_STREAK_MILESTONES = [
  { days: 100, bonus: 50 },
  { days: 60, bonus: 30 },
  { days: 30, bonus: 15 },
  { days: 7, bonus: 5 },
] as const;

export function getTierForLight(totalLight: number): LightTier {
  for (let i = LIGHT_TIERS.length - 1; i >= 0; i--) {
    if (totalLight >= LIGHT_TIERS[i].lightRequired) return LIGHT_TIERS[i];
  }
  return LIGHT_TIERS[0];
}

export function getMultiplier(perfectDayStreak: number): number {
  for (const entry of STREAK_MULTIPLIERS) {
    if (perfectDayStreak >= entry.minDays) return entry.multiplier;
  }
  return 1.0;
}

export function getTodoLight(priority: string): number {
  if (priority === "high" || priority === "urgent")
    return LIGHT_ACTIONS.TODO_COMPLETE_HIGH;
  if (priority === "medium") return LIGHT_ACTIONS.TODO_COMPLETE_MEDIUM;
  return LIGHT_ACTIONS.TODO_COMPLETE_LOW;
}
```

**Step 2: Commit**

```bash
git add apps/api/src/modules/light/domain/light-config.ts
git commit -m "feat(light): add Light config with tier thresholds, point values, and multiplier rules"
```

---

### Task 2: UserLight Entity

**Files:**

- Create: `apps/api/src/modules/light/domain/user-light.entity.ts`

**Step 1: Create the UserLight entity following existing Entity pattern**

```typescript
import { Entity, EntityProps, Ok, Result } from "../../../shared";
import { getTierForLight } from "./light-config";

export interface UserLightProps extends EntityProps {
  userId: string;
  totalLight: number;
  currentTier: number;
  currentTitle: string;
  perfectDayStreak: number;
  todoRingStreak: number;
  habitRingStreak: number;
  journalRingStreak: number;
  lastActiveDate: string | null;
  longestPerfectStreak: number;
  perfectDaysTotal: number;
}

export class UserLight extends Entity<UserLightProps> {
  private constructor(props: UserLightProps, id?: string) {
    super(props, id);
  }

  get userId(): string {
    return this.get("userId");
  }
  get totalLight(): number {
    return this.get("totalLight");
  }
  get currentTier(): number {
    return this.get("currentTier");
  }
  get currentTitle(): string {
    return this.get("currentTitle");
  }
  get perfectDayStreak(): number {
    return this.get("perfectDayStreak");
  }
  get todoRingStreak(): number {
    return this.get("todoRingStreak");
  }
  get habitRingStreak(): number {
    return this.get("habitRingStreak");
  }
  get journalRingStreak(): number {
    return this.get("journalRingStreak");
  }
  get lastActiveDate(): string | null {
    return this.get("lastActiveDate");
  }
  get longestPerfectStreak(): number {
    return this.get("longestPerfectStreak");
  }
  get perfectDaysTotal(): number {
    return this.get("perfectDaysTotal");
  }

  addLight(amount: number): void {
    this.set("totalLight", this.totalLight + amount);
    const tier = getTierForLight(this.totalLight);
    this.set("currentTier", tier.tier);
    this.set("currentTitle", tier.title);
  }

  updateStreaks(streaks: {
    perfectDayStreak: number;
    todoRingStreak: number;
    habitRingStreak: number;
    journalRingStreak: number;
    lastActiveDate: string;
  }): void {
    this.set("perfectDayStreak", streaks.perfectDayStreak);
    this.set("todoRingStreak", streaks.todoRingStreak);
    this.set("habitRingStreak", streaks.habitRingStreak);
    this.set("journalRingStreak", streaks.journalRingStreak);
    this.set("lastActiveDate", streaks.lastActiveDate);
    if (streaks.perfectDayStreak > this.longestPerfectStreak) {
      this.set("longestPerfectStreak", streaks.perfectDayStreak);
    }
  }

  incrementPerfectDays(): void {
    this.set("perfectDaysTotal", this.perfectDaysTotal + 1);
  }

  static create(userId: string): Result<UserLight> {
    return Ok(
      new UserLight({
        userId,
        totalLight: 0,
        currentTier: 1,
        currentTitle: "Stargazer",
        perfectDayStreak: 0,
        todoRingStreak: 0,
        habitRingStreak: 0,
        journalRingStreak: 0,
        lastActiveDate: null,
        longestPerfectStreak: 0,
        perfectDaysTotal: 0,
      } as UserLightProps),
    );
  }

  static reconstitute(props: UserLightProps, id: string): UserLight {
    return new UserLight(props, id);
  }
}
```

**Step 2: Commit**

```bash
git add apps/api/src/modules/light/domain/user-light.entity.ts
git commit -m "feat(light): add UserLight entity with tier progression and streak tracking"
```

---

### Task 3: LightEvent Entity

**Files:**

- Create: `apps/api/src/modules/light/domain/light-event.entity.ts`

**Step 1: Create the LightEvent entity**

```typescript
import { Entity, EntityProps, Ok, Result } from "../../../shared";

export type LightAction =
  | "todo_complete"
  | "habit_checkin"
  | "journal_entry"
  | "perfect_day"
  | "ring_streak_bonus";

export interface LightEventProps extends EntityProps {
  userId: string;
  workspaceId: string;
  action: LightAction;
  baseLight: number;
  multiplier: number;
  totalLight: number;
  date: string;
  metadata?: Record<string, unknown>;
}

export class LightEvent extends Entity<LightEventProps> {
  private constructor(props: LightEventProps, id?: string) {
    super(props, id);
  }

  get userId(): string {
    return this.get("userId");
  }
  get workspaceId(): string {
    return this.get("workspaceId");
  }
  get action(): LightAction {
    return this.get("action");
  }
  get baseLight(): number {
    return this.get("baseLight");
  }
  get multiplier(): number {
    return this.get("multiplier");
  }
  get totalLight(): number {
    return this.get("totalLight");
  }
  get date(): string {
    return this.get("date");
  }
  get metadata(): Record<string, unknown> | undefined {
    return this.get("metadata");
  }

  static create(
    props: Omit<LightEventProps, "id" | "createdAt" | "updatedAt">,
  ): Result<LightEvent> {
    return Ok(new LightEvent(props as LightEventProps));
  }

  static reconstitute(props: LightEventProps, id: string): LightEvent {
    return new LightEvent(props, id);
  }
}
```

**Step 2: Commit**

```bash
git add apps/api/src/modules/light/domain/light-event.entity.ts
git commit -m "feat(light): add LightEvent entity for point audit logging"
```

---

### Task 4: Mongoose Schemas

**Files:**

- Create: `apps/api/src/modules/light/user-light.schema.ts`
- Create: `apps/api/src/modules/light/light-event.schema.ts`

**Step 1: Create UserLight schema**

```typescript
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { randomUUID } from "crypto";

export type UserLightDocument = UserLightModel & Document<string>;

@Schema({
  collection: "user_lights",
  timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  toJSON: {
    transform: (_doc: any, ret: any) => {
      ret.id = ret._id;
      delete ret.__v;
      return ret;
    },
  },
})
export class UserLightModel {
  @Prop({ type: String, default: () => randomUUID() }) _id: string;
  @Prop({ type: String, required: true, unique: true, index: true })
  user_id: string;
  @Prop({ type: Number, required: true, default: 0 }) total_light: number;
  @Prop({ type: Number, required: true, default: 1 }) current_tier: number;
  @Prop({ type: String, required: true, default: "Stargazer" })
  current_title: string;
  @Prop({ type: Number, required: true, default: 0 })
  perfect_day_streak: number;
  @Prop({ type: Number, required: true, default: 0 }) todo_ring_streak: number;
  @Prop({ type: Number, required: true, default: 0 }) habit_ring_streak: number;
  @Prop({ type: Number, required: true, default: 0 })
  journal_ring_streak: number;
  @Prop({ type: String, default: null }) last_active_date: string;
  @Prop({ type: Number, required: true, default: 0 })
  longest_perfect_streak: number;
  @Prop({ type: Number, required: true, default: 0 })
  perfect_days_total: number;
}

export const UserLightSchema = SchemaFactory.createForClass(UserLightModel);
```

**Step 2: Create LightEvent schema**

```typescript
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { randomUUID } from "crypto";

export type LightEventDocument = LightEventModel & Document<string>;

@Schema({
  collection: "light_events",
  timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  toJSON: {
    transform: (_doc: any, ret: any) => {
      ret.id = ret._id;
      delete ret.__v;
      return ret;
    },
  },
})
export class LightEventModel {
  @Prop({ type: String, default: () => randomUUID() }) _id: string;
  @Prop({ type: String, required: true, index: true }) user_id: string;
  @Prop({ type: String, required: true }) workspace_id: string;
  @Prop({ type: String, required: true }) action: string;
  @Prop({ type: Number, required: true }) base_light: number;
  @Prop({ type: Number, required: true }) multiplier: number;
  @Prop({ type: Number, required: true }) total_light: number;
  @Prop({ type: String, required: true, index: true }) date: string;
  @Prop({ type: Object }) metadata: Record<string, unknown>;
}

export const LightEventSchema = SchemaFactory.createForClass(LightEventModel);
LightEventSchema.index({ user_id: 1, date: -1 });
LightEventSchema.index({ user_id: 1, action: 1, date: 1 });
```

**Step 3: Commit**

```bash
git add apps/api/src/modules/light/user-light.schema.ts apps/api/src/modules/light/light-event.schema.ts
git commit -m "feat(light): add Mongoose schemas for UserLight and LightEvent"
```

---

### Task 5: Repositories

**Files:**

- Create: `apps/api/src/modules/light/repository/user-light.repository.ts`
- Create: `apps/api/src/modules/light/repository/light-event.repository.ts`

**Step 1: Create UserLight repository**

```typescript
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { UserLightModel, UserLightDocument } from "../user-light.schema";
import { UserLight } from "../domain/user-light.entity";

@Injectable()
export class UserLightRepository {
  constructor(
    @InjectModel(UserLightModel.name) private model: Model<UserLightDocument>,
  ) {}

  async save(userLight: UserLight): Promise<void> {
    const data = userLight.toObject();
    await this.model.updateOne(
      { _id: data.id },
      {
        $set: {
          user_id: data.userId,
          total_light: data.totalLight,
          current_tier: data.currentTier,
          current_title: data.currentTitle,
          perfect_day_streak: data.perfectDayStreak,
          todo_ring_streak: data.todoRingStreak,
          habit_ring_streak: data.habitRingStreak,
          journal_ring_streak: data.journalRingStreak,
          last_active_date: data.lastActiveDate,
          longest_perfect_streak: data.longestPerfectStreak,
          perfect_days_total: data.perfectDaysTotal,
        },
      },
      { upsert: true },
    );
  }

  async findByUserId(userId: string): Promise<UserLight | null> {
    const doc = await this.model.findOne({ user_id: userId }).lean();
    return doc ? this.toDomain(doc) : null;
  }

  private toDomain(doc: any): UserLight {
    return UserLight.reconstitute(
      {
        userId: doc.user_id,
        totalLight: doc.total_light,
        currentTier: doc.current_tier,
        currentTitle: doc.current_title,
        perfectDayStreak: doc.perfect_day_streak,
        todoRingStreak: doc.todo_ring_streak,
        habitRingStreak: doc.habit_ring_streak,
        journalRingStreak: doc.journal_ring_streak,
        lastActiveDate: doc.last_active_date,
        longestPerfectStreak: doc.longest_perfect_streak,
        perfectDaysTotal: doc.perfect_days_total,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      },
      doc._id,
    );
  }
}
```

**Step 2: Create LightEvent repository**

```typescript
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { LightEventModel, LightEventDocument } from "../light-event.schema";
import { LightEvent } from "../domain/light-event.entity";

@Injectable()
export class LightEventRepository {
  constructor(
    @InjectModel(LightEventModel.name) private model: Model<LightEventDocument>,
  ) {}

  async save(event: LightEvent): Promise<void> {
    const data = event.toObject();
    await this.model.updateOne(
      { _id: data.id },
      {
        $set: {
          user_id: data.userId,
          workspace_id: data.workspaceId,
          action: data.action,
          base_light: data.baseLight,
          multiplier: data.multiplier,
          total_light: data.totalLight,
          date: data.date,
          metadata: data.metadata,
        },
      },
      { upsert: true },
    );
  }

  async findByUser(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ docs: LightEvent[]; total: number }> {
    const total = await this.model.countDocuments({ user_id: userId });
    const docs = await this.model
      .find({ user_id: userId })
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limit)
      .lean();
    return { docs: docs.map((doc) => this.toDomain(doc)), total };
  }

  async existsForEntityOnDate(
    userId: string,
    action: string,
    date: string,
    entityId: string,
  ): Promise<boolean> {
    const count = await this.model.countDocuments({
      user_id: userId,
      action,
      date,
      "metadata.entityId": entityId,
    });
    return count > 0;
  }

  private toDomain(doc: any): LightEvent {
    return LightEvent.reconstitute(
      {
        userId: doc.user_id,
        workspaceId: doc.workspace_id,
        action: doc.action,
        baseLight: doc.base_light,
        multiplier: doc.multiplier,
        totalLight: doc.total_light,
        date: doc.date,
        metadata: doc.metadata,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      },
      doc._id,
    );
  }
}
```

**Step 3: Commit**

```bash
git add apps/api/src/modules/light/repository/
git commit -m "feat(light): add UserLight and LightEvent repositories"
```

---

### Task 6: Light Service (Core Engine)

**Files:**

- Create: `apps/api/src/modules/light/light.service.ts`

**Step 1: Create the Light service with point awarding, streak evaluation, and deduplication**

```typescript
import { Injectable } from "@nestjs/common";
import { UserLightRepository } from "./repository/user-light.repository";
import { LightEventRepository } from "./repository/light-event.repository";
import { UserLight } from "./domain/user-light.entity";
import { LightEvent, LightAction } from "./domain/light-event.entity";
import {
  getTodoLight,
  getMultiplier,
  LIGHT_ACTIONS,
  RING_STREAK_MILESTONES,
} from "./domain/light-config";
import { format, subDays, differenceInCalendarDays, parseISO } from "date-fns";

@Injectable()
export class LightService {
  constructor(
    private readonly userLightRepo: UserLightRepository,
    private readonly lightEventRepo: LightEventRepository,
  ) {}

  async getOrCreateUserLight(userId: string): Promise<UserLight> {
    const existing = await this.userLightRepo.findByUserId(userId);
    if (existing) return existing;
    const result = UserLight.create(userId);
    if (!result.ok) throw result.error;
    await this.userLightRepo.save(result.value);
    return result.value;
  }

  async getUserLight(userId: string): Promise<UserLight> {
    return this.getOrCreateUserLight(userId);
  }

  async getEvents(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ docs: LightEvent[]; total: number }> {
    return this.lightEventRepo.findByUser(userId, limit, offset);
  }

  async awardTodoComplete(
    userId: string,
    workspaceId: string,
    todoId: string,
    priority: string,
  ): Promise<void> {
    const today = this.getToday();
    const isDuplicate = await this.lightEventRepo.existsForEntityOnDate(
      userId,
      "todo_complete",
      today,
      todoId,
    );
    if (isDuplicate) return;

    const baseLight = getTodoLight(priority);
    await this.awardLight(
      userId,
      workspaceId,
      "todo_complete",
      baseLight,
      today,
      {
        entityId: todoId,
        priority,
      },
    );
  }

  async awardHabitCheckin(
    userId: string,
    workspaceId: string,
    habitId: string,
    entryId: string,
  ): Promise<void> {
    const today = this.getToday();
    const isDuplicate = await this.lightEventRepo.existsForEntityOnDate(
      userId,
      "habit_checkin",
      today,
      entryId,
    );
    if (isDuplicate) return;

    await this.awardLight(
      userId,
      workspaceId,
      "habit_checkin",
      LIGHT_ACTIONS.HABIT_CHECKIN,
      today,
      { entityId: entryId, habitId },
    );
  }

  async awardJournalEntry(
    userId: string,
    workspaceId: string,
    journalId: string,
  ): Promise<void> {
    const today = this.getToday();
    const isDuplicate = await this.lightEventRepo.existsForEntityOnDate(
      userId,
      "journal_entry",
      today,
      journalId,
    );
    if (isDuplicate) return;

    await this.awardLight(
      userId,
      workspaceId,
      "journal_entry",
      LIGHT_ACTIONS.JOURNAL_ENTRY,
      today,
      { entityId: journalId },
    );
  }

  async evaluateDay(
    userId: string,
    workspaceId: string,
    rings: { todo: boolean; habit: boolean; journal: boolean },
  ): Promise<void> {
    const today = this.getToday();
    const userLight = await this.getOrCreateUserLight(userId);
    const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
    const isConsecutive = userLight.lastActiveDate === yesterday;

    const todoStreak = rings.todo
      ? isConsecutive
        ? userLight.todoRingStreak + 1
        : 1
      : 0;
    const habitStreak = rings.habit
      ? isConsecutive
        ? userLight.habitRingStreak + 1
        : 1
      : 0;
    const journalStreak = rings.journal
      ? isConsecutive
        ? userLight.journalRingStreak + 1
        : 1
      : 0;

    const isPerfectDay = rings.todo && rings.habit && rings.journal;
    const perfectStreak = isPerfectDay
      ? isConsecutive
        ? userLight.perfectDayStreak + 1
        : 1
      : 0;

    userLight.updateStreaks({
      perfectDayStreak: perfectStreak,
      todoRingStreak: todoStreak,
      habitRingStreak: habitStreak,
      journalRingStreak: journalStreak,
      lastActiveDate: today,
    });

    if (isPerfectDay) {
      userLight.incrementPerfectDays();
      const multiplier = getMultiplier(perfectStreak);
      const totalLight = Math.round(LIGHT_ACTIONS.PERFECT_DAY * multiplier);
      const eventResult = LightEvent.create({
        userId,
        workspaceId,
        action: "perfect_day",
        baseLight: LIGHT_ACTIONS.PERFECT_DAY,
        multiplier,
        totalLight,
        date: today,
      });
      if (eventResult.ok) {
        await this.lightEventRepo.save(eventResult.value);
        userLight.addLight(totalLight);
      }
    }

    // Check ring streak milestones
    await this.checkStreakMilestones(
      userLight,
      userId,
      workspaceId,
      today,
      "todo",
      todoStreak,
    );
    await this.checkStreakMilestones(
      userLight,
      userId,
      workspaceId,
      today,
      "habit",
      habitStreak,
    );
    await this.checkStreakMilestones(
      userLight,
      userId,
      workspaceId,
      today,
      "journal",
      journalStreak,
    );

    await this.userLightRepo.save(userLight);
  }

  private async checkStreakMilestones(
    userLight: UserLight,
    userId: string,
    workspaceId: string,
    date: string,
    ring: string,
    streak: number,
  ): Promise<void> {
    for (const milestone of RING_STREAK_MILESTONES) {
      if (streak === milestone.days) {
        const eventResult = LightEvent.create({
          userId,
          workspaceId,
          action: "ring_streak_bonus",
          baseLight: milestone.bonus,
          multiplier: 1,
          totalLight: milestone.bonus,
          date,
          metadata: { ring, streakLength: milestone.days },
        });
        if (eventResult.ok) {
          await this.lightEventRepo.save(eventResult.value);
          userLight.addLight(milestone.bonus);
        }
      }
    }
  }

  private async awardLight(
    userId: string,
    workspaceId: string,
    action: LightAction,
    baseLight: number,
    date: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const userLight = await this.getOrCreateUserLight(userId);
    const multiplier = getMultiplier(userLight.perfectDayStreak);
    const totalLight = Math.round(baseLight * multiplier);

    const eventResult = LightEvent.create({
      userId,
      workspaceId,
      action,
      baseLight,
      multiplier,
      totalLight,
      date,
      metadata,
    });
    if (!eventResult.ok) return;

    await this.lightEventRepo.save(eventResult.value);
    userLight.addLight(totalLight);
    await this.userLightRepo.save(userLight);
  }

  private getToday(): string {
    return format(new Date(), "yyyy-MM-dd");
  }
}
```

**Step 2: Commit**

```bash
git add apps/api/src/modules/light/light.service.ts
git commit -m "feat(light): add LightService with point awarding, deduplication, and streak evaluation"
```

---

### Task 7: Light DTOs and Controller

**Files:**

- Create: `apps/api/src/modules/light/light.dto.ts`
- Create: `apps/api/src/modules/light/light.controller.ts`

**Step 1: Create DTOs**

```typescript
import { z } from "zod";

export const GetLightEventsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type GetLightEventsQuery = z.infer<typeof GetLightEventsQuery>;
```

**Step 2: Create controller**

```typescript
import { Controller, Get, Query } from "@nestjs/common";
import { LightService } from "./light.service";
import { GetLightEventsQuery } from "./light.dto";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { CurrentUserId } from "../../common/decorators/current-user.decorator";

@Controller("light")
export class LightController {
  constructor(private readonly service: LightService) {}

  @Get("me")
  async getMyLight(@CurrentUserId() userId: string) {
    const userLight = await this.service.getUserLight(userId);
    return userLight.toObject();
  }

  @Get("events")
  async getEvents(
    @CurrentUserId() userId: string,
    @Query(new ZodValidationPipe(GetLightEventsQuery))
    query: GetLightEventsQuery,
  ) {
    const { docs, total } = await this.service.getEvents(
      userId,
      query.limit,
      query.offset,
    );
    return {
      data: docs.map((d) => d.toObject()),
      meta: { total, limit: query.limit, offset: query.offset },
    };
  }
}
```

**Step 3: Commit**

```bash
git add apps/api/src/modules/light/light.dto.ts apps/api/src/modules/light/light.controller.ts
git commit -m "feat(light): add Light controller with GET /light/me and GET /light/events"
```

---

### Task 8: Light Module + Register in AppModule

**Files:**

- Create: `apps/api/src/modules/light/light.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Step 1: Create the Light module**

```typescript
import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { UserLightModel, UserLightSchema } from "./user-light.schema";
import { LightEventModel, LightEventSchema } from "./light-event.schema";
import { UserLightRepository } from "./repository/user-light.repository";
import { LightEventRepository } from "./repository/light-event.repository";
import { LightService } from "./light.service";
import { LightController } from "./light.controller";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserLightModel.name, schema: UserLightSchema },
      { name: LightEventModel.name, schema: LightEventSchema },
    ]),
  ],
  controllers: [LightController],
  providers: [UserLightRepository, LightEventRepository, LightService],
  exports: [LightService],
})
export class LightModule {}
```

**Step 2: Register in AppModule**

Add to `apps/api/src/app.module.ts`:

- Add import: `import { LightModule } from './modules/light/light.module';`
- Add `LightModule` to the imports array (after `CalendarModule`)

**Step 3: Commit**

```bash
git add apps/api/src/modules/light/light.module.ts apps/api/src/app.module.ts
git commit -m "feat(light): register Light module in AppModule"
```

---

### Task 9: Integrate Light into Existing Services

**Files:**

- Modify: `apps/api/src/modules/todo/todo.service.ts`
- Modify: `apps/api/src/modules/todo/todo.module.ts`
- Modify: `apps/api/src/modules/habit-entry/habit-entry.service.ts` (or wherever habit entry creation lives)
- Modify: `apps/api/src/modules/habit-entry/habit-entry.module.ts`
- Modify: `apps/api/src/modules/journal/journal.service.ts`
- Modify: `apps/api/src/modules/journal/journal.module.ts`

**Step 1: Integrate into TodoService**

In `todo.service.ts`:

- Add constructor parameter: `private readonly lightService: LightService`
- Add import: `import { LightService } from '../light/light.service';`
- In `updateStatus()` method, after `await this.repository.save(todo)`, add:

```typescript
if (status === "done") {
  this.lightService
    .awardTodoComplete(userId, workspaceId, id, todo.priority)
    .catch(() => {});
}
```

In `todo.module.ts`:

- Add `LightModule` to imports
- Add import: `import { LightModule } from '../light/light.module';`

**Step 2: Integrate into HabitEntry service**

In the habit entry creation method, after saving the entry, add:

```typescript
this.lightService
  .awardHabitCheckin(userId, workspaceId, habitId, entry.id)
  .catch(() => {});
```

In the habit-entry module:

- Add `LightModule` to imports

**Step 3: Integrate into JournalService**

In `journal.service.ts`, in the `create()` method, after `await this.repository.save(result.value)`, add:

```typescript
this.lightService
  .awardJournalEntry(userId, workspaceId, result.value.id)
  .catch(() => {});
```

In `journal.module.ts`:

- Add `LightModule` to imports

**Step 4: Verify the API compiles**

Run: `cd apps/api && bun run build`
Expected: Build succeeds with no errors

**Step 5: Commit**

```bash
git add apps/api/src/modules/todo/ apps/api/src/modules/habit-entry/ apps/api/src/modules/journal/
git commit -m "feat(light): integrate Light service into todo, habit-entry, and journal modules"
```

---

### Task 10: Frontend Types

**Files:**

- Create: `packages/core/src/types/light.ts`
- Modify: `packages/core/src/types/index.ts` (add export)

**Step 1: Create Light types**

```typescript
export interface UserLight {
  id: string;
  userId: string;
  totalLight: number;
  currentTier: number;
  currentTitle: string;
  perfectDayStreak: number;
  todoRingStreak: number;
  habitRingStreak: number;
  journalRingStreak: number;
  lastActiveDate: string | null;
  longestPerfectStreak: number;
  perfectDaysTotal: number;
  createdAt: string;
  updatedAt: string;
}

export interface LightEvent {
  id: string;
  userId: string;
  workspaceId: string;
  action:
    | "todo_complete"
    | "habit_checkin"
    | "journal_entry"
    | "perfect_day"
    | "ring_streak_bonus";
  baseLight: number;
  multiplier: number;
  totalLight: number;
  date: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface LightTier {
  tier: number;
  title: string;
  lightRequired: number;
}

export const LIGHT_TIERS: LightTier[] = [
  { tier: 1, title: "Stargazer", lightRequired: 0 },
  { tier: 2, title: "Spark", lightRequired: 50 },
  { tier: 3, title: "Ember", lightRequired: 150 },
  { tier: 4, title: "Flame", lightRequired: 400 },
  { tier: 5, title: "Radiant", lightRequired: 800 },
  { tier: 6, title: "Flare", lightRequired: 1500 },
  { tier: 7, title: "Nova", lightRequired: 2800 },
  { tier: 8, title: "Pulsar", lightRequired: 5000 },
  { tier: 9, title: "Supernova", lightRequired: 8500 },
  { tier: 10, title: "Meridian", lightRequired: 13000 },
];

export function getNextTier(currentTier: number): LightTier | null {
  if (currentTier >= 10) return null;
  return LIGHT_TIERS[currentTier]; // tier is 1-indexed, array is 0-indexed, so currentTier gives next
}

export function getTierProgress(
  totalLight: number,
  currentTier: number,
): number {
  const current = LIGHT_TIERS[currentTier - 1];
  const next = LIGHT_TIERS[currentTier];
  if (!next) return 100; // Max tier
  const range = next.lightRequired - current.lightRequired;
  const progress = totalLight - current.lightRequired;
  return Math.min(100, Math.round((progress / range) * 100));
}
```

**Step 2: Add export to types index**

Add to `packages/core/src/types/index.ts`:

```typescript
export * from "./light";
```

**Step 3: Commit**

```bash
git add packages/core/src/types/light.ts packages/core/src/types/index.ts
git commit -m "feat(light): add frontend Light types and tier utilities"
```

---

### Task 11: Frontend API Client + React Query Hooks

**Files:**

- Create: `packages/core/src/api/light.ts`
- Create: `apps/pwa/lib/api/light.ts`

**Step 1: Create API client functions**

In `packages/core/src/api/light.ts`:

```typescript
import type { AxiosInstance } from "axios";
import type { UserLight, LightEvent } from "../types/light";

export function createLightApi(client: AxiosInstance) {
  return {
    getMe: async (): Promise<UserLight> => {
      const { data } = await client.get("/light/me");
      return data;
    },
    getEvents: async (
      limit = 20,
      offset = 0,
    ): Promise<{
      data: LightEvent[];
      meta: { total: number; limit: number; offset: number };
    }> => {
      const { data } = await client.get("/light/events", {
        params: { limit, offset },
      });
      return data;
    },
  };
}
```

Add export to `packages/core/src/api/index.ts`:

```typescript
export * from "./light";
```

**Step 2: Create React Query hooks**

In `apps/pwa/lib/api/light.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import apiClient from "../api-client";
import { createLightApi } from "@repo/core/api/light";
import type { UserLight, LightEvent } from "@repo/core/types/light";

const lightApi = createLightApi(apiClient);

export const lightKeys = {
  me: ["light", "me"] as const,
  events: (limit: number, offset: number) =>
    ["light", "events", limit, offset] as const,
};

export function useUserLight() {
  return useQuery<UserLight>({
    queryKey: lightKeys.me,
    queryFn: () => lightApi.getMe(),
  });
}

export function useLightEvents(limit = 20, offset = 0) {
  return useQuery({
    queryKey: lightKeys.events(limit, offset),
    queryFn: () => lightApi.getEvents(limit, offset),
  });
}
```

**Step 3: Commit**

```bash
git add packages/core/src/api/light.ts packages/core/src/api/index.ts apps/pwa/lib/api/light.ts
git commit -m "feat(light): add Light API client and React Query hooks"
```

---

### Task 12: Star Visual Component

**Files:**

- Create: `apps/pwa/components/light/star-visual.tsx`

**Step 1: Create the star SVG component that changes appearance per tier**

```typescript
'use client';

import { cn } from '@repo/ui/lib/utils';

interface StarVisualProps {
  tier: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  animate?: boolean;
  className?: string;
}

const TIER_COLORS: Record<number, { core: string; glow: string; outer: string }> = {
  1: { core: '#94a3b8', glow: '#cbd5e1', outer: '#e2e8f0' },      // Stargazer - silver
  2: { core: '#fbbf24', glow: '#fde68a', outer: '#fef3c7' },      // Spark - warm yellow
  3: { core: '#f59e0b', glow: '#fbbf24', outer: '#fde68a' },      // Ember - amber
  4: { core: '#ef4444', glow: '#f97316', outer: '#fbbf24' },      // Flame - red-orange
  5: { core: '#f97316', glow: '#fbbf24', outer: '#fef3c7' },      // Radiant - bright orange
  6: { core: '#ec4899', glow: '#f472b6', outer: '#fbcfe8' },      // Flare - pink
  7: { core: '#8b5cf6', glow: '#a78bfa', outer: '#c4b5fd' },      // Nova - purple
  8: { core: '#3b82f6', glow: '#60a5fa', outer: '#93c5fd' },      // Pulsar - blue
  9: { core: '#f59e0b', glow: '#fbbf24', outer: '#ffffff' },      // Supernova - gold-white
  10: { core: '#ffffff', glow: '#fbbf24', outer: '#f59e0b' },     // Meridian - white-gold
};

const SIZES = { sm: 24, md: 40, lg: 56, xl: 80 };

export function StarVisual({ tier, size = 'md', animate = true, className }: StarVisualProps) {
  const s = SIZES[size];
  const colors = TIER_COLORS[tier] || TIER_COLORS[1];
  const r = s / 2;
  const coreR = r * 0.25;
  const glowR = r * 0.5;
  const outerR = r * 0.8;

  return (
    <svg
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      className={cn(animate && tier >= 7 && 'animate-pulse', className)}
    >
      <defs>
        <radialGradient id={`star-grad-${tier}-${size}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={colors.core} />
          <stop offset="40%" stopColor={colors.glow} stopOpacity={0.8} />
          <stop offset="100%" stopColor={colors.outer} stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* Outer glow - visible from tier 4+ */}
      {tier >= 4 && (
        <circle
          cx={r}
          cy={r}
          r={outerR}
          fill={`url(#star-grad-${tier}-${size})`}
          opacity={0.3 + (tier - 4) * 0.1}
        />
      )}

      {/* Mid glow - visible from tier 2+ */}
      {tier >= 2 && (
        <circle cx={r} cy={r} r={glowR} fill={colors.glow} opacity={0.4 + tier * 0.05} />
      )}

      {/* Core star */}
      <circle cx={r} cy={r} r={coreR + (tier - 1) * (coreR * 0.15)} fill={colors.core} />

      {/* Rays for tier 6+ */}
      {tier >= 6 &&
        Array.from({ length: tier >= 8 ? 8 : 4 }).map((_, i) => {
          const angle = (i * 360) / (tier >= 8 ? 8 : 4);
          const rad = (angle * Math.PI) / 180;
          const innerDist = coreR + 2;
          const outerDist = glowR - 2;
          return (
            <line
              key={i}
              x1={r + Math.cos(rad) * innerDist}
              y1={r + Math.sin(rad) * innerDist}
              x2={r + Math.cos(rad) * outerDist}
              y2={r + Math.sin(rad) * outerDist}
              stroke={colors.core}
              strokeWidth={1}
              opacity={0.6}
            />
          );
        })}

      {/* Orbiting dots for tier 8+ */}
      {tier >= 8 &&
        Array.from({ length: tier >= 9 ? 4 : 2 }).map((_, i) => {
          const angle = (i * 360) / (tier >= 9 ? 4 : 2) + 45;
          const rad = (angle * Math.PI) / 180;
          const dist = glowR + 2;
          return (
            <circle
              key={`orbit-${i}`}
              cx={r + Math.cos(rad) * dist}
              cy={r + Math.sin(rad) * dist}
              r={1.5}
              fill={colors.glow}
              opacity={0.8}
            />
          );
        })}
    </svg>
  );
}
```

**Step 2: Commit**

```bash
git add apps/pwa/components/light/star-visual.tsx
git commit -m "feat(light): add StarVisual SVG component with per-tier appearances"
```

---

### Task 13: Level Progress Bar Component

**Files:**

- Create: `apps/pwa/components/light/level-progress.tsx`

**Step 1: Create the level progress bar**

```typescript
'use client';

import { cn } from '@repo/ui/lib/utils';
import { Flame } from 'lucide-react';
import type { UserLight } from '@repo/core/types/light';
import { getNextTier, getTierProgress } from '@repo/core/types/light';

interface LevelProgressProps {
  userLight: UserLight;
  className?: string;
}

export function LevelProgress({ userLight, className }: LevelProgressProps) {
  const nextTier = getNextTier(userLight.currentTier);
  const progress = getTierProgress(userLight.totalLight, userLight.currentTier);
  const multiplier = getMultiplierDisplay(userLight.perfectDayStreak);

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{userLight.currentTitle}</span>
        {nextTier && (
          <span className="text-muted-foreground">{nextTier.title}</span>
        )}
      </div>

      <div className="bg-muted h-2 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {userLight.totalLight.toLocaleString()}
          {nextTier ? ` / ${nextTier.lightRequired.toLocaleString()} Light` : ' Light (Max)'}
        </span>
        {userLight.perfectDayStreak > 0 && (
          <span className="flex items-center gap-1">
            <Flame className="h-3 w-3 text-orange-500" />
            <span>{multiplier} streak {userLight.perfectDayStreak}d</span>
          </span>
        )}
      </div>
    </div>
  );
}

function getMultiplierDisplay(perfectDayStreak: number): string {
  if (perfectDayStreak >= 30) return '3x';
  if (perfectDayStreak >= 14) return '2.5x';
  if (perfectDayStreak >= 7) return '2x';
  if (perfectDayStreak >= 3) return '1.5x';
  return '1x';
}
```

**Step 2: Commit**

```bash
git add apps/pwa/components/light/level-progress.tsx
git commit -m "feat(light): add LevelProgress bar component"
```

---

### Task 14: Integrate Star into Activity Rings Center

**Files:**

- Modify: `apps/pwa/components/activity-rings/activity-rings-visual.tsx`
- Modify: `apps/pwa/components/activity-rings/activity-rings.tsx`

**Step 1: Add star to activity rings visual center**

In `activity-rings-visual.tsx`, add a `foreignObject` in the SVG center to render the StarVisual component. Add a `star` prop:

```typescript
// Add to props interface:
star?: { tier: number };

// Add inside the SVG, after the ring circles:
{star && (
  <foreignObject x={50 - innerR + strokeWidth} y={50 - innerR + strokeWidth} width={(innerR - strokeWidth) * 2} height={(innerR - strokeWidth) * 2}>
    <div className="flex h-full w-full items-center justify-center">
      <StarVisual tier={star.tier} size={/* map ring size to star size */} animate />
    </div>
  </foreignObject>
)}
```

**Step 2: Pass star data from ActivityRings container**

In `activity-rings.tsx`, import `useUserLight` and pass `star={{ tier: userLight.currentTier }}` to `ActivityRingsVisual`.

**Step 3: Commit**

```bash
git add apps/pwa/components/activity-rings/
git commit -m "feat(light): render star visual in activity rings center"
```

---

### Task 15: Dashboard Integration

**Files:**

- Modify: `apps/pwa/app/[shortId]/dashboard/page.tsx`

**Step 1: Add level progress bar below activity rings**

Import `LevelProgress` and `useUserLight`. After the `<ActivityRings>` component, render:

```typescript
const { data: userLight } = useUserLight();

// After <ActivityRings>:
{userLight && <LevelProgress userLight={userLight} />}
```

**Step 2: Commit**

```bash
git add apps/pwa/app/[shortId]/dashboard/page.tsx
git commit -m "feat(light): add level progress bar to dashboard"
```

---

### Task 16: Level-Up Celebration Overlay

**Files:**

- Create: `apps/pwa/components/light/level-up-celebration.tsx`

**Step 1: Create the celebration overlay**

```typescript
'use client';

import { useEffect, useState } from 'react';
import { StarVisual } from './star-visual';
import { LIGHT_TIERS } from '@repo/core/types/light';

interface LevelUpCelebrationProps {
  tier: number;
  onDismiss: () => void;
}

export function LevelUpCelebration({ tier, onDismiss }: LevelUpCelebrationProps) {
  const tierInfo = LIGHT_TIERS[tier - 1];

  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={onDismiss}
    >
      <div className="flex flex-col items-center gap-4 animate-in zoom-in-95 duration-500">
        <StarVisual tier={tier} size="xl" animate />
        <h2 className="text-2xl font-bold text-white">
          You&apos;ve become a {tierInfo?.title}
        </h2>
        <p className="text-white/70 text-sm">Tap to dismiss</p>
      </div>
    </div>
  );
}
```

**Step 2: Create a hook to detect level-ups**

Create `apps/pwa/lib/hooks/use-level-up.ts`:

```typescript
"use client";

import { useEffect, useRef, useState } from "react";
import type { UserLight } from "@repo/core/types/light";

export function useLevelUp(userLight: UserLight | undefined) {
  const prevTier = useRef<number | null>(null);
  const [levelUpTier, setLevelUpTier] = useState<number | null>(null);

  useEffect(() => {
    if (!userLight) return;
    if (prevTier.current !== null && userLight.currentTier > prevTier.current) {
      setLevelUpTier(userLight.currentTier);
    }
    prevTier.current = userLight.currentTier;
  }, [userLight?.currentTier]);

  return {
    levelUpTier,
    dismiss: () => setLevelUpTier(null),
  };
}
```

**Step 3: Integrate into dashboard layout**

In the dashboard page or a layout wrapper, add:

```typescript
const { levelUpTier, dismiss } = useLevelUp(userLight);

// In JSX:
{levelUpTier && <LevelUpCelebration tier={levelUpTier} onDismiss={dismiss} />}
```

**Step 4: Commit**

```bash
git add apps/pwa/components/light/level-up-celebration.tsx apps/pwa/lib/hooks/use-level-up.ts apps/pwa/app/[shortId]/dashboard/page.tsx
git commit -m "feat(light): add level-up celebration overlay with auto-dismiss"
```

---

### Task 17: Compact Sidebar Badge

**Files:**

- Modify: sidebar/nav component (find exact path during implementation)

**Step 1: Add star badge next to user avatar in sidebar**

Import `StarVisual` and `useUserLight`. Render a small star next to the user name/avatar:

```typescript
const { data: userLight } = useUserLight();

// Next to user avatar:
{userLight && (
  <div className="flex items-center gap-1" title={`${userLight.currentTitle} - ${userLight.totalLight} Light`}>
    <StarVisual tier={userLight.currentTier} size="sm" />
  </div>
)}
```

**Step 2: Commit**

```bash
git add <sidebar-file>
git commit -m "feat(light): add compact star badge to sidebar"
```

---

### Task 18: My Journey Page

**Files:**

- Create: `apps/pwa/app/[shortId]/journey/page.tsx`
- Create: `apps/pwa/components/light/journey-streaks.tsx`
- Create: `apps/pwa/components/light/journey-tier-map.tsx`
- Create: `apps/pwa/components/light/journey-stats.tsx`
- Create: `apps/pwa/components/light/journey-feed.tsx`

**Step 1: Create the streaks grid component**

`journey-streaks.tsx`:

```typescript
'use client';

import { Flame, CheckCircle2, Repeat2, BookOpen } from 'lucide-react';
import type { UserLight } from '@repo/core/types/light';

interface JourneyStreaksProps {
  userLight: UserLight;
}

export function JourneyStreaks({ userLight }: JourneyStreaksProps) {
  const streaks = [
    {
      label: 'Perfect',
      icon: Flame,
      current: userLight.perfectDayStreak,
      best: userLight.longestPerfectStreak,
      color: 'text-orange-500',
    },
    {
      label: 'Todos',
      icon: CheckCircle2,
      current: userLight.todoRingStreak,
      best: null,
      color: 'text-blue-500',
    },
    {
      label: 'Habits',
      icon: Repeat2,
      current: userLight.habitRingStreak,
      best: null,
      color: 'text-orange-500',
    },
    {
      label: 'Journal',
      icon: BookOpen,
      current: userLight.journalRingStreak,
      best: null,
      color: 'text-green-500',
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-3">
      {streaks.map((s) => (
        <div key={s.label} className="rounded-lg border p-3 text-center">
          <s.icon className={`mx-auto h-5 w-5 ${s.color}`} />
          <p className="mt-1 text-lg font-bold">{s.current}d</p>
          <p className="text-xs text-muted-foreground">{s.label}</p>
          {s.best !== null && (
            <p className="text-xs text-muted-foreground mt-0.5">best: {s.best}d</p>
          )}
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Create tier map component**

`journey-tier-map.tsx`:

```typescript
'use client';

import { StarVisual } from './star-visual';
import { LIGHT_TIERS } from '@repo/core/types/light';

interface JourneyTierMapProps {
  currentTier: number;
}

export function JourneyTierMap({ currentTier }: JourneyTierMapProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {LIGHT_TIERS.map((t, i) => {
        const isCompleted = t.tier < currentTier;
        const isCurrent = t.tier === currentTier;
        const isFuture = t.tier > currentTier;

        return (
          <div key={t.tier} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1">
              <div className={isFuture ? 'opacity-30' : ''}>
                <StarVisual tier={t.tier} size="sm" animate={isCurrent} />
              </div>
              <span
                className={`text-xs ${
                  isCurrent
                    ? 'font-bold text-foreground'
                    : isCompleted
                      ? 'text-muted-foreground'
                      : 'text-muted-foreground/50'
                }`}
              >
                {t.title}
              </span>
            </div>
            {i < LIGHT_TIERS.length - 1 && (
              <div
                className={`h-px w-4 ${
                  isCompleted ? 'bg-foreground/30' : 'bg-muted-foreground/20'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
```

**Step 3: Create stats grid component**

`journey-stats.tsx`:

```typescript
'use client';

import type { UserLight } from '@repo/core/types/light';

interface JourneyStatsProps {
  userLight: UserLight;
}

export function JourneyStats({ userLight }: JourneyStatsProps) {
  const multiplier = getMultiplier(userLight.perfectDayStreak);

  const stats = [
    { label: 'Total Light', value: userLight.totalLight.toLocaleString() },
    { label: 'Perfect Days', value: userLight.perfectDaysTotal.toString() },
    { label: 'Longest Streak', value: `${userLight.longestPerfectStreak}d` },
    { label: 'Multiplier', value: `${multiplier}x` },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="rounded-lg border p-3">
          <p className="text-lg font-bold">{s.value}</p>
          <p className="text-xs text-muted-foreground">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

function getMultiplier(streak: number): string {
  if (streak >= 30) return '3';
  if (streak >= 14) return '2.5';
  if (streak >= 7) return '2';
  if (streak >= 3) return '1.5';
  return '1';
}
```

**Step 4: Create light event feed component**

`journey-feed.tsx`:

```typescript
'use client';

import { useLightEvents } from '@/lib/api/light';
import type { LightEvent } from '@repo/core/types/light';
import { format, parseISO } from 'date-fns';

const ACTION_LABELS: Record<string, string> = {
  todo_complete: 'Completed todo',
  habit_checkin: 'Habit check-in',
  journal_entry: 'Journal entry',
  perfect_day: 'Perfect Day bonus',
  ring_streak_bonus: 'Streak milestone',
};

export function JourneyFeed() {
  const { data, isLoading } = useLightEvents(50, 0);

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading...</div>;
  if (!data?.data.length) return <div className="text-sm text-muted-foreground">No Light earned yet</div>;

  const grouped = groupByDate(data.data);

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([date, events]) => {
        const dayTotal = events.reduce((sum, e) => sum + e.totalLight, 0);
        return (
          <div key={date}>
            <div className="flex items-center justify-between text-sm font-medium mb-2">
              <span>{format(parseISO(date), 'MMM d, yyyy')}</span>
              <span className="text-amber-500">+{dayTotal} Light</span>
            </div>
            <div className="space-y-1 pl-2">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between text-xs text-muted-foreground"
                >
                  <span>{ACTION_LABELS[event.action] || event.action}</span>
                  <span>
                    {event.baseLight} x {event.multiplier}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function groupByDate(events: LightEvent[]): Record<string, LightEvent[]> {
  const groups: Record<string, LightEvent[]> = {};
  for (const event of events) {
    if (!groups[event.date]) groups[event.date] = [];
    groups[event.date].push(event);
  }
  return groups;
}
```

**Step 5: Create the Journey page**

`apps/pwa/app/[shortId]/journey/page.tsx`:

```typescript
'use client';

import { useUserLight } from '@/lib/api/light';
import { StarVisual } from '@/components/light/star-visual';
import { LevelProgress } from '@/components/light/level-progress';
import { JourneyStreaks } from '@/components/light/journey-streaks';
import { JourneyTierMap } from '@/components/light/journey-tier-map';
import { JourneyStats } from '@/components/light/journey-stats';
import { JourneyFeed } from '@/components/light/journey-feed';

export default function JourneyPage() {
  const { data: userLight, isLoading } = useUserLight();

  if (isLoading || !userLight) {
    return <div className="p-4 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-4">
      {/* Hero */}
      <div className="flex flex-col items-center gap-3">
        <StarVisual tier={userLight.currentTier} size="xl" animate />
        <h1 className="text-xl font-bold">{userLight.currentTitle}</h1>
        <LevelProgress userLight={userLight} className="w-full" />
      </div>

      {/* Streaks */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Streaks</h2>
        <JourneyStreaks userLight={userLight} />
      </section>

      {/* Tier Map */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Tier Map</h2>
        <JourneyTierMap currentTier={userLight.currentTier} />
      </section>

      {/* Stats */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Stats</h2>
        <JourneyStats userLight={userLight} />
      </section>

      {/* Recent Light */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Recent Light</h2>
        <JourneyFeed />
      </section>
    </div>
  );
}
```

**Step 6: Add Journey link to navigation**

Find the sidebar/nav component and add a link:

```typescript
{ href: `/${shortId}/journey`, label: 'My Journey', icon: Star }
```

**Step 7: Commit**

```bash
git add apps/pwa/components/light/ apps/pwa/app/[shortId]/journey/ <nav-file>
git commit -m "feat(light): add My Journey page with streaks, tier map, stats, and event feed"
```

---

### Task 19: Dashboard Link to Journey

**Files:**

- Modify: `apps/pwa/app/[shortId]/dashboard/page.tsx`

**Step 1: Make the star + level bar clickable, linking to Journey page**

Wrap the `ActivityRings` and `LevelProgress` section in a `Link` to `/${shortId}/journey`:

```typescript
import Link from 'next/link';

<Link href={`/${shortId}/journey`} className="block">
  <ActivityRings date={today} size="xl" showLabels />
  {userLight && <LevelProgress userLight={userLight} className="mt-3" />}
</Link>
```

**Step 2: Commit**

```bash
git add apps/pwa/app/[shortId]/dashboard/page.tsx
git commit -m "feat(light): link dashboard rings + progress bar to Journey page"
```

---

### Task 20: Final Verification

**Step 1: Build the API**

Run: `cd apps/api && bun run build`
Expected: Compiles successfully

**Step 2: Build the PWA**

Run: `cd apps/pwa && bun run build`
Expected: Compiles successfully

**Step 3: Manual smoke test**

1. Start API and PWA dev servers
2. Complete a todo — verify Light increases in dashboard
3. Check-in a habit — verify Light increases
4. Write a journal entry — verify Light increases
5. Navigate to My Journey page — verify all sections render
6. Check sidebar badge shows star icon

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(light): address build issues from Light system integration"
```
