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
  createdAt: string;
}
