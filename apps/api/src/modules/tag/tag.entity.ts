import { Entity, EntityProps, Ok, Err, Result } from "../../shared";

export interface TagProps extends EntityProps {
  name: string;
  color: string;
  userSub: string;
}

export class Tag extends Entity<TagProps> {
  private constructor(props: TagProps, id?: string) {
    super(props, id);
  }

  get name(): string {
    return this.get("name");
  }
  get color(): string {
    return this.get("color");
  }
  get userSub(): string {
    return this.get("userSub");
  }

  updateName(name: string): void {
    this.set("name", name);
  }
  updateColor(color: string): void {
    this.set("color", color);
  }

  static create(
    props: Omit<TagProps, "id" | "createdAt" | "updatedAt">,
  ): Result<Tag> {
    if (!props.name || props.name.trim().length === 0)
      return Err(new Error("Tag name is required"));
    if (!props.userSub) return Err(new Error("User is required"));
    return Ok(
      new Tag({ ...props, color: props.color || "#6B7280" } as TagProps),
    );
  }

  static reconstitute(props: TagProps, id: string): Tag {
    return new Tag(props, id);
  }
}
