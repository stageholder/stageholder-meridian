import { Entity, EntityProps, Ok, Err, Result } from "../../shared";

export interface NotificationProps extends EntityProps {
  userSub: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  read: boolean;
  readAt?: Date;
}

export class Notification extends Entity<NotificationProps> {
  private constructor(props: NotificationProps, id?: string) {
    super(props, id);
  }

  get userSub(): string {
    return this.get("userSub");
  }
  get type(): string {
    return this.get("type");
  }
  get title(): string {
    return this.get("title");
  }
  get message(): string {
    return this.get("message");
  }
  get entityType(): string | undefined {
    return this.get("entityType");
  }
  get entityId(): string | undefined {
    return this.get("entityId");
  }
  get read(): boolean {
    return this.get("read");
  }
  get readAt(): Date | undefined {
    return this.get("readAt");
  }

  markAsRead(): void {
    this.set("read", true);
    this.set("readAt", new Date());
  }

  static create(
    props: Omit<NotificationProps, "id" | "createdAt" | "updatedAt">,
  ): Result<Notification> {
    if (!props.userSub) return Err(new Error("User is required"));
    if (!props.type) return Err(new Error("Type is required"));
    if (!props.title) return Err(new Error("Title is required"));
    if (!props.message) return Err(new Error("Message is required"));
    return Ok(
      new Notification({
        ...props,
        read: props.read ?? false,
      } as NotificationProps),
    );
  }

  static reconstitute(props: NotificationProps, id: string): Notification {
    return new Notification(props, id);
  }
}
