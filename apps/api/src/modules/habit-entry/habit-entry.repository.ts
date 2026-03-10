import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HabitEntryModel, HabitEntryDocument } from './habit-entry.schema';
import { HabitEntry } from './habit-entry.entity';

@Injectable()
export class HabitEntryRepository {
  constructor(@InjectModel(HabitEntryModel.name) private model: Model<HabitEntryDocument>) {}

  async save(entry: HabitEntry): Promise<void> {
    const data = entry.toObject();
    await this.model.updateOne({ _id: data.id }, { $set: { habit_id: data.habitId, date: data.date, value: data.value, type: data.type || 'completion', skip_reason: data.skipReason, notes: data.notes, workspace_id: data.workspaceId } }, { upsert: true });
  }

  async findById(id: string): Promise<HabitEntry | null> {
    const doc = await this.model.findOne({ _id: id, deleted_at: null }).lean();
    return doc ? this.toDomain(doc) : null;
  }

  async findByHabitAndDate(habitId: string, date: string): Promise<HabitEntry | null> {
    const doc = await this.model.findOne({ habit_id: habitId, date, deleted_at: null }).lean();
    return doc ? this.toDomain(doc) : null;
  }

  async findByHabit(habitId: string): Promise<HabitEntry[]> {
    const docs = await this.model.find({ habit_id: habitId, deleted_at: null }).sort({ date: -1 }).lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  async findByHabitPaginated(habitId: string, page: number, limit: number): Promise<{ docs: HabitEntry[]; total: number }> {
    const total = await this.model.countDocuments({ habit_id: habitId, deleted_at: null });
    const docs = await this.model.find({ habit_id: habitId, deleted_at: null }).sort({ date: -1 }).skip((page - 1) * limit).limit(limit).lean();
    return { docs: docs.map((doc) => this.toDomain(doc)), total };
  }

  async findByHabitAndDateRange(habitId: string, startDate: string, endDate: string): Promise<HabitEntry[]> {
    const docs = await this.model.find({ habit_id: habitId, date: { $gte: startDate, $lte: endDate }, deleted_at: null }).sort({ date: -1 }).lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  async findByWorkspaceAndDateRange(workspaceId: string, startDate: string, endDate: string): Promise<HabitEntry[]> {
    const docs = await this.model.find({ workspace_id: workspaceId, deleted_at: null, date: { $gte: startDate, $lte: endDate } }).sort({ date: -1 }).lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  async delete(id: string): Promise<void> { await this.model.updateOne({ _id: id }, { $set: { deleted_at: new Date() } }); }

  async countSkipsByWorkspaceCreatorAndDate(workspaceId: string, date: string): Promise<number> {
    return this.model.countDocuments({ workspace_id: workspaceId, date, type: 'skip', deleted_at: null });
  }

  private toDomain(doc: any): HabitEntry {
    return HabitEntry.reconstitute({ habitId: doc.habit_id, date: doc.date, value: doc.value, type: doc.type || 'completion', skipReason: doc.skip_reason, notes: doc.notes, workspaceId: doc.workspace_id, createdAt: doc.created_at, updatedAt: doc.updated_at }, doc._id);
  }
}
