import { Entity, EntityProps, Ok, Err, Result } from '../../shared';

export type MemberRole = 'owner' | 'admin' | 'member' | 'viewer';
export type InvitationStatus = 'pending' | 'accepted';

export interface WorkspaceMemberProps extends EntityProps {
  workspaceId: string;
  userId?: string;
  email: string;
  role: MemberRole;
  invitationStatus: InvitationStatus;
  invitationToken?: string;
  expiresAt?: Date;
}

export class WorkspaceMember extends Entity<WorkspaceMemberProps> {
  private constructor(props: WorkspaceMemberProps, id?: string) { super(props, id); }

  get workspaceId(): string { return this.get('workspaceId'); }
  get userId(): string | undefined { return this.get('userId'); }
  get email(): string { return this.get('email'); }
  get role(): MemberRole { return this.get('role'); }
  get invitationStatus(): InvitationStatus { return this.get('invitationStatus'); }
  get invitationToken(): string | undefined { return this.get('invitationToken'); }
  get expiresAt(): Date | undefined { return this.get('expiresAt'); }

  isExpired(): boolean {
    const exp = this.expiresAt;
    return !!exp && exp.getTime() < Date.now();
  }

  accept(userId: string): void {
    this.set('userId', userId);
    this.set('invitationStatus', 'accepted');
    this.set('invitationToken', undefined);
    this.set('expiresAt', undefined);
  }

  regenerateToken(token: string, expiresAt: Date): void {
    this.set('invitationToken', token);
    this.set('expiresAt', expiresAt);
  }

  updateRole(role: MemberRole): void { this.set('role', role); }

  static create(props: Omit<WorkspaceMemberProps, 'id' | 'createdAt' | 'updatedAt'>): Result<WorkspaceMember> {
    if (!props.workspaceId) return Err(new Error('Workspace ID is required'));
    if (!props.email) return Err(new Error('Email is required'));
    return Ok(new WorkspaceMember(props as WorkspaceMemberProps));
  }

  static reconstitute(props: WorkspaceMemberProps, id: string): WorkspaceMember { return new WorkspaceMember(props, id); }
}
