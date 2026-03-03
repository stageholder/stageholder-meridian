export interface AppNotification {
  id: string;
  workspaceId: string;
  recipientId: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  read: boolean;
  readAt?: string;
  createdAt: string;
}
