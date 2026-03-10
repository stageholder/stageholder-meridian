import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LightEventModel, LightEventDocument } from '../light-event.schema';
import { LightEvent } from '../domain/light-event.entity';

@Injectable()
export class LightEventRepository {
  constructor(@InjectModel(LightEventModel.name) private model: Model<LightEventDocument>) {}

  async save(event: LightEvent): Promise<void> {
    const data = event.toObject();
    await this.model.updateOne({ _id: data.id }, { $set: { user_id: data.userId, workspace_id: data.workspaceId, action: data.action, base_light: data.baseLight, multiplier: data.multiplier, total_light: data.totalLight, date: data.date, metadata: data.metadata } }, { upsert: true });
  }

  async findByUser(userId: string, limit: number, offset: number): Promise<{ docs: LightEvent[]; total: number }> {
    const total = await this.model.countDocuments({ user_id: userId, deleted_at: null });
    const docs = await this.model.find({ user_id: userId, deleted_at: null }).sort({ created_at: -1 }).skip(offset).limit(limit).lean();
    return { docs: docs.map((doc) => this.toDomain(doc)), total };
  }

  async existsForEntityOnDate(userId: string, action: string, date: string, entityId: string): Promise<boolean> {
    const doc = await this.model.findOne({ user_id: userId, action, date, 'metadata.entityId': entityId, deleted_at: null }).lean();
    return !!doc;
  }

  async countByUserActionDate(userId: string, action: string, date: string): Promise<number> {
    return this.model.countDocuments({ user_id: userId, action, date, deleted_at: null });
  }

  private toDomain(doc: any): LightEvent {
    return LightEvent.reconstitute({ userId: doc.user_id, workspaceId: doc.workspace_id, action: doc.action, baseLight: doc.base_light, multiplier: doc.multiplier, totalLight: doc.total_light, date: doc.date, metadata: doc.metadata, createdAt: doc.created_at, updatedAt: doc.updated_at }, doc._id);
  }
}
