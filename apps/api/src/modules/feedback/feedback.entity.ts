import { Entity, EntityProps, Ok, Err, Result } from "../../shared";

export interface FeedbackProps extends EntityProps {
  userSub: string;
  type: "general" | "bug" | "feature";
  message: string;
}

export class Feedback extends Entity<FeedbackProps> {
  private constructor(props: FeedbackProps, id?: string) {
    super(props, id);
  }

  get userSub(): string {
    return this.get("userSub");
  }
  get type(): string {
    return this.get("type");
  }
  get message(): string {
    return this.get("message");
  }

  static create(
    props: Omit<FeedbackProps, "id" | "createdAt" | "updatedAt">,
  ): Result<Feedback> {
    if (!props.userSub) return Err(new Error("User is required"));
    if (!props.message?.trim()) return Err(new Error("Message is required"));
    if (!["general", "bug", "feature"].includes(props.type))
      return Err(new Error("Invalid feedback type"));
    return Ok(new Feedback(props as FeedbackProps));
  }

  static reconstitute(props: FeedbackProps, id: string): Feedback {
    return new Feedback(props, id);
  }
}
