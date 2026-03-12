import { Entity, EntityProps, Ok, Err, Result } from "../../shared";

export interface NotificationProps extends EntityProps {
  recipientId: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  read: boolean;
  readAt?: Date;
  workspaceId: string;
}

export class Notification extends Entity<NotificationProps> {
  private constructor(props: NotificationProps, id?: string) {
    super(props, id);
  }

  get recipientId(): string {
    return this.get("recipientId");
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
  get actorId(): string | undefined {
    return this.get("actorId");
  }
  get read(): boolean {
    return this.get("read");
  }
  get readAt(): Date | undefined {
    return this.get("readAt");
  }
  get workspaceId(): string {
    return this.get("workspaceId");
  }

  markAsRead(): void {
    this.set("read", true);
    this.set("readAt", new Date());
  }

  static create(
    props: Omit<NotificationProps, "id" | "createdAt" | "updatedAt">,
  ): Result<Notification> {
    if (!props.recipientId) return Err(new Error("Recipient is required"));
    if (!props.type) return Err(new Error("Type is required"));
    if (!props.title) return Err(new Error("Title is required"));
    if (!props.message) return Err(new Error("Message is required"));
    if (!props.workspaceId) return Err(new Error("Workspace is required"));
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
