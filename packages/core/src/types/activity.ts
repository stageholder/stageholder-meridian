export interface Activity {
  id: string;
  userSub: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  entityTitle: string;
  changes?: Record<string, { from: unknown; to: unknown }>;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
