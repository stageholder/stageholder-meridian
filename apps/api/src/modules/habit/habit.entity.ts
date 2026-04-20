import { Entity, EntityProps, Ok, Err, Result } from "../../shared";

export type HabitFrequency = "daily" | "weekly" | "custom";

export interface HabitProps extends EntityProps {
  name: string;
  description?: string;
  frequency: HabitFrequency;
  targetCount: number;
  scheduledDays?: number[];
  unit?: string;
  color?: string;
  icon?: string;
  userSub: string;
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
  updateUnit(unit: string | undefined): void {
    this.set("unit", unit);
  }
  updateColor(color: string | undefined): void {
    this.set("color", color);
  }
  updateIcon(icon: string | undefined): void {
    this.set("icon", icon);
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
      } as HabitProps),
    );
  }

  static reconstitute(props: HabitProps, id: string): Habit {
    return new Habit(props, id);
  }
}
