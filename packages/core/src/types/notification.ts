export interface AppNotification {
  id: string;
  userSub: string;
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
