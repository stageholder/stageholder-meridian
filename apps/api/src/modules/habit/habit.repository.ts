import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HabitModel, HabitDocument } from './habit.schema';
import { Habit } from './habit.entity';

@Injectable()
export class HabitRepository {
  constructor(@InjectModel(HabitModel.name) private model: Model<HabitDocument>) {}

  async save(habit: Habit): Promise<void> {
    const data = habit.toObject();
    await this.model.updateOne({ _id: data.id }, { $set: { name: data.name, description: data.description, frequency: data.frequency, target_count: data.targetCount, unit: data.unit, color: data.color, icon: data.icon, workspace_id: data.workspaceId, creator_id: data.creatorId } }, { upsert: true });
  }

  async findById(id: string): Promise<Habit | null> {
    const doc = await this.model.findOne({ _id: id, deleted_at: null }).lean();
    return doc ? this.toDomain(doc) : null;
  }

  async findByWorkspace(workspaceId: string): Promise<Habit[]> {
    const docs = await this.model.find({ workspace_id: workspaceId, deleted_at: null }).lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  async findByWorkspacePaginated(workspaceId: string, page: number, limit: number): Promise<{ docs: Habit[]; total: number }> {
    const total = await this.model.countDocuments({ workspace_id: workspaceId, deleted_at: null });
    const docs = await this.model.find({ workspace_id: workspaceId, deleted_at: null }).sort({ created_at: -1 }).skip((page - 1) * limit).limit(limit).lean();
    return { docs: docs.map((doc) => this.toDomain(doc)), total };
  }

  async delete(id: string): Promise<void> { await this.model.updateOne({ _id: id }, { $set: { deleted_at: new Date() } }); }

  private toDomain(doc: any): Habit {
    return Habit.reconstitute({ name: doc.name, description: doc.description, frequency: doc.frequency, targetCount: doc.target_count, unit: doc.unit, color: doc.color, icon: doc.icon, workspaceId: doc.workspace_id, creatorId: doc.creator_id, createdAt: doc.created_at, updatedAt: doc.updated_at }, doc._id);
  }
}
