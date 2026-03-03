import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JournalModel, JournalDocument } from './journal.schema';
import { Journal } from './journal.entity';

@Injectable()
export class JournalRepository {
  constructor(@InjectModel(JournalModel.name) private model: Model<JournalDocument>) {}

  async save(journal: Journal): Promise<void> {
    const data = journal.toObject();
    await this.model.updateOne({ _id: data.id }, { $set: { title: data.title, content: data.content, mood: data.mood, tags: data.tags, workspace_id: data.workspaceId, author_id: data.authorId, date: data.date } }, { upsert: true });
  }

  async findById(id: string): Promise<Journal | null> {
    const doc = await this.model.findById(id).lean();
    return doc ? this.toDomain(doc) : null;
  }

  async findByWorkspace(workspaceId: string): Promise<Journal[]> {
    const docs = await this.model.find({ workspace_id: workspaceId }).sort({ date: -1 }).lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  async findByDateRange(workspaceId: string, startDate: string, endDate: string): Promise<Journal[]> {
    const docs = await this.model.find({ workspace_id: workspaceId, date: { $gte: startDate, $lte: endDate } }).sort({ date: -1 }).lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  async delete(id: string): Promise<void> { await this.model.deleteOne({ _id: id }); }

  private toDomain(doc: any): Journal {
    return Journal.reconstitute({ title: doc.title, content: doc.content, mood: doc.mood, tags: doc.tags || [], workspaceId: doc.workspace_id, authorId: doc.author_id, date: doc.date, createdAt: doc.created_at, updatedAt: doc.updated_at }, doc._id);
  }
}
