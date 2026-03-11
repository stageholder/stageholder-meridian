import { Entity, EntityProps, Ok, Result } from "../../../shared";

export type LightAction =
  | "todo_create"
  | "todo_complete"
  | "habit_checkin"
  | "journal_entry"
  | "perfect_day"
  | "ring_streak_bonus"
  | "ring_completion_bonus";

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
    props: Omit<LightEventProps, keyof EntityProps>,
  ): Result<LightEvent> {
    const event = new LightEvent({
      ...props,
    });
    return Ok(event);
  }

  static reconstitute(props: LightEventProps, id: string): LightEvent {
    return new LightEvent(props, id);
  }
}
