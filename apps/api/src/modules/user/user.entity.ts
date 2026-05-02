import { Entity, EntityProps, Ok, Err, Result } from "../../shared";

export interface UserProps extends EntityProps {
  sub: string;
  hasCompletedOnboarding: boolean;
}

export class User extends Entity<UserProps> {
  private constructor(props: UserProps, id?: string) {
    super(props, id);
  }

  get sub(): string {
    return this.get("sub");
  }
  get hasCompletedOnboarding(): boolean {
    return this.get("hasCompletedOnboarding");
  }

  completeOnboarding(): void {
    this.set("hasCompletedOnboarding", true);
  }

  static create(
    props: Omit<UserProps, "id" | "createdAt" | "updatedAt">,
  ): Result<User> {
    if (!props.sub || props.sub.trim().length === 0) {
      return Err(new Error("sub is required"));
    }
    return Ok(new User({ ...props }));
  }

  static reconstitute(props: UserProps, id: string): User {
    return new User(props, id);
  }
}
