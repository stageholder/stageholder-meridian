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
    await this.model.updateOne({ _id: data.id }, { $set: { habit_id: data.habitId, date: data.date, value: data.value, notes: data.notes, workspace_id: data.workspaceId } }, { upsert: true });
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

  async delete(id: string): Promise<void> { await this.model.updateOne({ _id: id }, { $set: { deleted_at: new Date() } }); }

  private toDomain(doc: any): HabitEntry {
    return HabitEntry.reconstitute({ habitId: doc.habit_id, date: doc.date, value: doc.value, notes: doc.notes, workspaceId: doc.workspace_id, createdAt: doc.created_at, updatedAt: doc.updated_at }, doc._id);
  }
}
