export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  timezone?: string;
  provider: 'local' | 'google';
  emailVerified: boolean;
  createdAt: string;
  personalWorkspaceShortId?: string;
}
