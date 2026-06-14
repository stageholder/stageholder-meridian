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
