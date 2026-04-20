import { Entity, EntityProps, Ok, Err, Result } from "../../shared";

export interface ActivityChanges {
  [key: string]: { from: unknown; to: unknown };
}

export interface ActivityProps extends EntityProps {
  userSub: string;
  action: string;
  entityType: string;
  entityId: string;
  entityTitle: string;
  changes?: ActivityChanges;
  metadata?: Record<string, unknown>;
}

export class Activity extends Entity<ActivityProps> {
  private constructor(props: ActivityProps, id?: string) {
    super(props, id);
  }

  get userSub(): string {
    return this.get("userSub");
  }
  get action(): string {
    return this.get("action");
  }
  get entityType(): string {
    return this.get("entityType");
  }
  get entityId(): string {
    return this.get("entityId");
  }
  get entityTitle(): string {
    return this.get("entityTitle");
  }
  get changes(): ActivityChanges | undefined {
    return this.get("changes");
  }
  get metadata(): Record<string, unknown> | undefined {
    return this.get("metadata");
  }

  static create(
    props: Omit<ActivityProps, "id" | "createdAt" | "updatedAt">,
  ): Result<Activity> {
    if (!props.userSub) return Err(new Error("User is required"));
    if (!props.action) return Err(new Error("Action is required"));
    if (!props.entityType) return Err(new Error("Entity type is required"));
    if (!props.entityId) return Err(new Error("Entity ID is required"));
    if (!props.entityTitle) return Err(new Error("Entity title is required"));
    return Ok(new Activity(props as ActivityProps));
  }

  static reconstitute(props: ActivityProps, id: string): Activity {
    return new Activity(props, id);
  }
}
