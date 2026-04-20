import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { JournalModel, JournalDocument } from "./journal.schema";
import { Journal } from "./journal.entity";

@Injectable()
export class JournalRepository {
  constructor(
    @InjectModel(JournalModel.name) private model: Model<JournalDocument>,
  ) {}

  async save(journal: Journal): Promise<void> {
    const data = journal.toObject();
    const now = new Date();
    await this.model.updateOne(
      { _id: data.id },
      {
        $set: {
          title: data.title,
          content: data.content,
          mood: data.mood,
          tags: data.tags,
          userSub: data.userSub,
          date: data.date,
          word_count: data.wordCount,
          encrypted: data.encrypted ?? false,
          updated_at: now,
        },
        $setOnInsert: { created_at: now },
      },
      { upsert: true },
    );
  }

  async findById(userSub: string, id: string): Promise<Journal | null> {
    const doc = await this.model
      .findOne({ _id: id, userSub, deleted_at: null })
      .lean();
    return doc ? this.toDomain(doc) : null;
  }

  async findByUser(userSub: string): Promise<Journal[]> {
    const docs = await this.model
      .find({ userSub, deleted_at: null })
      .sort({ date: -1, created_at: -1 })
      .lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  async findByUserPaginated(
    userSub: string,
    page: number,
    limit: number,
  ): Promise<{ docs: Journal[]; total: number }> {
    const filter: Record<string, any> = { userSub, deleted_at: null };
    const total = await this.model.countDocuments(filter);
    const docs = await this.model
      .find(filter)
      .sort({ date: -1, created_at: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    return { docs: docs.map((doc) => this.toDomain(doc)), total };
  }

  async findByDateRange(
    userSub: string,
    startDate: string,
    endDate: string,
  ): Promise<Journal[]> {
    const filter: Record<string, any> = {
      userSub,
      deleted_at: null,
      date: { $gte: startDate, $lte: endDate },
    };
    const docs = await this.model
      .find(filter)
      .sort({ date: -1, created_at: -1 })
      .lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  async delete(userSub: string, id: string): Promise<void> {
    await this.model.updateOne(
      { _id: id, userSub },
      { $set: { deleted_at: new Date() } },
    );
  }

  // Hard-delete every journal for the given userSub. Used by the Hub
  // user.deleted cascade — soft-delete is insufficient here because the
  // user no longer exists and the row must be fully purged.
  async deleteAllForUser(userSub: string): Promise<number> {
    const { deletedCount } = await this.model.deleteMany({ userSub });
    return deletedCount ?? 0;
  }

  async findUpdatedSince(
    userSub: string,
    since: string,
    includeSoftDeleted = false,
  ): Promise<Journal[]> {
    const filter: any = {
      userSub,
      updated_at: { $gt: new Date(since) },
    };
    if (!includeSoftDeleted) filter.deleted_at = null;
    const docs = await this.model.find(filter).lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  async getGrowthStats(
    userSub: string,
    windowStart: string,
  ): Promise<{
    window: Array<{ date: string; count: number; words: number }>;
    baseline: { count: number; words: number };
  }> {
    const matchStage: Record<string, any> = { userSub, deleted_at: null };

    const result = await this.model.aggregate([
      { $match: matchStage },
      {
        $facet: {
          window: [
            { $match: { date: { $gte: windowStart } } },
            {
              $group: {
                _id: "$date",
                count: { $sum: 1 },
                words: { $sum: "$word_count" },
              },
            },
            { $sort: { _id: 1 } },
          ],
          baseline: [
            { $match: { date: { $lt: windowStart } } },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                words: { $sum: "$word_count" },
              },
            },
          ],
        },
      },
    ]);

    const facet = result[0] ?? { window: [], baseline: [] };
    return {
      window: facet.window.map((d: any) => ({
        date: d._id,
        count: d.count,
        words: d.words,
      })),
      baseline: facet.baseline[0]
        ? { count: facet.baseline[0].count, words: facet.baseline[0].words }
        : { count: 0, words: 0 },
    };
  }

  private toDomain(doc: any): Journal {
    return Journal.reconstitute(
      {
        title: doc.title,
        content: doc.content,
        mood: doc.mood,
        tags: doc.tags || [],
        userSub: doc.userSub,
        date: doc.date,
        wordCount: doc.word_count ?? 0,
        encrypted: doc.encrypted ?? false,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      },
      doc._id,
    );
  }
}
