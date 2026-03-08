import { Entity, EntityProps, Ok, Err, Result } from '../../shared';

export enum AuthProvider { LOCAL = 'local', GOOGLE = 'google' }

export interface UserProps extends EntityProps {
  email: string;
  name: string;
  passwordHash?: string;
  provider: AuthProvider;
  providerId?: string;
  emailVerified: boolean;
  avatar?: string;
  timezone?: string;
  onboardingCompleted: boolean;
}

export class User extends Entity<UserProps> {
  private constructor(props: UserProps, id?: string) { super(props, id); }

  get email(): string { return this.get('email'); }
  get name(): string { return this.get('name'); }
  get passwordHash(): string | undefined { return this.get('passwordHash'); }
  get provider(): AuthProvider { return this.get('provider'); }
  get providerId(): string | undefined { return this.get('providerId'); }
  get emailVerified(): boolean { return this.get('emailVerified'); }
  get avatar(): string | undefined { return this.get('avatar'); }
  get timezone(): string | undefined { return this.get('timezone'); }
  get onboardingCompleted(): boolean { return this.get('onboardingCompleted'); }

  updateName(name: string): void { this.set('name', name); }
  updateAvatar(avatar: string): void { this.set('avatar', avatar); }
  updateTimezone(timezone: string): void { this.set('timezone', timezone); }
  updatePasswordHash(hash: string): void { this.set('passwordHash', hash); }
  markEmailVerified(): void { this.set('emailVerified', true); }
  completeOnboarding(): void { this.set('onboardingCompleted', true); }

  static create(props: Omit<UserProps, 'id' | 'createdAt' | 'updatedAt' | 'onboardingCompleted'>): Result<User> {
    if (!props.email || !props.email.includes('@')) return Err(new Error('Invalid email'));
    if (!props.name || props.name.trim().length === 0) return Err(new Error('Name is required'));
    if (props.provider === AuthProvider.LOCAL && !props.passwordHash) return Err(new Error('Password is required for local accounts'));
    return Ok(new User({ ...props, onboardingCompleted: false } as UserProps));
  }

  static reconstitute(props: UserProps, id: string): User { return new User(props, id); }
}
