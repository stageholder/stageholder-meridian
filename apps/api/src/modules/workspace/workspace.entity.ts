import {
  Entity,
  EntityProps,
  Ok,
  Err,
  Result,
  generateShortId,
} from "../../shared";

export interface WorkspaceProps extends EntityProps {
  name: string;
  shortId: string;
  description?: string;
  ownerId: string;
  isPersonal?: boolean;
}

export class Workspace extends Entity<WorkspaceProps> {
  private constructor(props: WorkspaceProps, id?: string) {
    super(props, id);
  }

  get name(): string {
    return this.get("name");
  }
  get shortId(): string {
    return this.get("shortId");
  }
  get description(): string | undefined {
    return this.get("description");
  }
  get ownerId(): string {
    return this.get("ownerId");
  }
  get isPersonal(): boolean {
    return this.get("isPersonal") ?? false;
  }

  updateName(name: string): void {
    this.set("name", name);
  }
  updateDescription(description: string): void {
    this.set("description", description);
  }

  static create(
    props: Omit<WorkspaceProps, "id" | "createdAt" | "updatedAt" | "shortId">,
  ): Result<Workspace> {
    if (!props.name || props.name.trim().length === 0)
      return Err(new Error("Workspace name is required"));
    if (!props.ownerId) return Err(new Error("Owner is required"));
    const shortId = generateShortId();
    return Ok(
      new Workspace({
        ...props,
        shortId,
        isPersonal: props.isPersonal ?? false,
      } as WorkspaceProps),
    );
  }

  static reconstitute(props: WorkspaceProps, id: string): Workspace {
    return new Workspace(props, id);
  }
}
