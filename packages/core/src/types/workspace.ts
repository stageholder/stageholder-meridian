export interface Workspace {
  id: string;
  name: string;
  shortId: string;
  description?: string;
  ownerId: string;
  isPersonal?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId?: string;
  email: string;
  role: string;
  invitationStatus: string;
  invitationToken?: string;
  expiresAt?: string;
  inviteLink?: string;
  createdAt: string;
}

export interface InvitationInfo {
  workspaceName: string;
  role: string;
  email: string;
  expired: boolean;
}

export interface AcceptedInvitation extends WorkspaceMember {
  workspaceShortId: string;
}
