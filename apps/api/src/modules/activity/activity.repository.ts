import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ActivityModel, ActivityDocument } from './activity.schema';
import { Activity } from './activity.entity';

@Injectable()
export class ActivityRepository {
  constructor(@InjectModel(ActivityModel.name) private model: Model<ActivityDocument>) {}

  async save(activity: Activity): Promise<void> {
    const data = activity.toObject();
    await this.model.updateOne({ _id: data.id }, { $set: { actor_id: data.actorId, action: data.action, entity_type: data.entityType, entity_id: data.entityId, entity_title: data.entityTitle, changes: data.changes, metadata: data.metadata, workspace_id: data.workspaceId } }, { upsert: true });
  }

  async findByWorkspace(workspaceId: string, page: number, limit: number): Promise<{ docs: Activity[]; total: number }> {
    const total = await this.model.countDocuments({ workspace_id: workspaceId, deleted_at: null });
    const docs = await this.model.find({ workspace_id: workspaceId, deleted_at: null }).sort({ created_at: -1 }).skip((page - 1) * limit).limit(limit).lean();
    return { docs: docs.map((doc) => this.toDomain(doc)), total };
  }

  async findByEntity(entityType: string, entityId: string): Promise<Activity[]> {
    const docs = await this.model.find({ entity_type: entityType, entity_id: entityId, deleted_at: null }).sort({ created_at: -1 }).lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  private toDomain(doc: any): Activity {
    return Activity.reconstitute({ actorId: doc.actor_id, action: doc.action, entityType: doc.entity_type, entityId: doc.entity_id, entityTitle: doc.entity_title, changes: doc.changes, metadata: doc.metadata, workspaceId: doc.workspace_id, createdAt: doc.created_at, updatedAt: doc.updated_at }, doc._id);
  }
}
