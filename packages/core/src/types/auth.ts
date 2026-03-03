export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  timezone?: string;
  provider: string;
  emailVerified: boolean;
  createdAt: string;
}
