import { Entity, EntityProps, Ok, Err, Result } from "../../shared";

export type HabitFrequency = "daily" | "weekly" | "weekly_target" | "custom";

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

export class Habit extends Entity<HabitProps> {
  private constructor(props: HabitProps, id?: string) {
    super(props, id);
  }

  get name(): string {
    return this.get("name");
  }
  get description(): string | undefined {
    return this.get("description");
  }
  get frequency(): HabitFrequency {
    return this.get("frequency");
  }
  get targetCount(): number {
    return this.get("targetCount");
  }
  get scheduledDays(): number[] | undefined {
    return this.get("scheduledDays");
  }
  get weeklyTarget(): number | undefined {
    return this.get("weeklyTarget");
  }
  get unit(): string | undefined {
    return this.get("unit");
  }
  get color(): string | undefined {
    return this.get("color");
  }
  get icon(): string | undefined {
    return this.get("icon");
  }
  get userSub(): string {
    return this.get("userSub");
  }
  get groupId(): string | null | undefined {
    return this.get("groupId");
  }
  get order(): number {
    return this.get("order");
  }
  get archivedAt(): string | null | undefined {
    return this.get("archivedAt");
  }

  updateName(name: string): void {
    this.set("name", name);
  }
  updateDescription(description: string | undefined): void {
    this.set("description", description);
  }
  updateFrequency(frequency: HabitFrequency): void {
    this.set("frequency", frequency);
  }
  updateTargetCount(targetCount: number): void {
    this.set("targetCount", targetCount);
  }
  updateScheduledDays(scheduledDays: number[] | undefined): void {
    this.set("scheduledDays", scheduledDays);
  }
  updateWeeklyTarget(weeklyTarget: number | undefined): void {
    this.set("weeklyTarget", weeklyTarget);
  }
  updateUnit(unit: string | undefined): void {
    this.set("unit", unit);
  }
  updateColor(color: string | undefined): void {
    this.set("color", color);
  }
  updateIcon(icon: string | undefined): void {
    this.set("icon", icon);
  }
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

  static create(
    props: Omit<HabitProps, "id" | "createdAt" | "updatedAt">,
  ): Result<Habit> {
    if (!props.name || props.name.trim().length === 0)
      return Err(new Error("Habit name is required"));
    if (!props.userSub) return Err(new Error("User is required"));
    if (!props.targetCount || props.targetCount < 1)
      return Err(new Error("Target count must be at least 1"));
    return Ok(
      new Habit({
        ...props,
        frequency: props.frequency || "daily",
        groupId: props.groupId ?? null,
        order: props.order ?? 0,
        archivedAt: props.archivedAt ?? null,
      } as HabitProps),
    );
  }

  static reconstitute(props: HabitProps, id: string): Habit {
    return new Habit(props, id);
  }
}
