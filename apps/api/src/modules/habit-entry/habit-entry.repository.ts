import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { HabitEntryModel, HabitEntryDocument } from "./habit-entry.schema";
import { HabitEntry } from "./habit-entry.entity";
import { EncryptionService } from "../encryption";

// Two lists because HabitEntry entity uses camelCase (skipReason) while the MongoDB doc uses snake_case (skip_reason).
// save() operates on entity shape, toDomain() operates on document shape.
const ENCRYPTED_ENTITY_FIELDS = ["notes", "skipReason"];
const ENCRYPTED_DOC_FIELDS = ["notes", "skip_reason"];

@Injectable()
export class HabitEntryRepository {
  constructor(
    @InjectModel(HabitEntryModel.name) private model: Model<HabitEntryDocument>,
    private readonly encryption: EncryptionService,
  ) {}

  async save(entry: HabitEntry): Promise<void> {
    const data = entry.toObject();
    const enc = this.encryption.encryptRecord(
      { notes: data.notes, skipReason: data.skipReason },
      ENCRYPTED_ENTITY_FIELDS,
    );
    await this.model.updateOne(
      { _id: data.id },
      {
        $set: {
          habit_id: data.habitId,
          date: data.date,
          value: data.value,
          type: data.type || "completion",
          skip_reason: enc.skipReason,
          notes: enc.notes,
          userSub: data.userSub,
          target_count_snapshot: data.targetCountSnapshot,
          scheduled_days_snapshot: data.scheduledDaysSnapshot,
        },
      },
      { upsert: true },
    );
  }

  async findById(userSub: string, id: string): Promise<HabitEntry | null> {
    const doc = await this.model
      .findOne({ _id: id, userSub, deleted_at: null })
      .lean();
    return doc ? this.toDomain(doc) : null;
  }

  async findByHabitAndDate(
    userSub: string,
    habitId: string,
    date: string,
  ): Promise<HabitEntry | null> {
    const doc = await this.model
      .findOne({ userSub, habit_id: habitId, date, deleted_at: null })
      .lean();
    return doc ? this.toDomain(doc) : null;
  }

  async findByHabit(userSub: string, habitId: string): Promise<HabitEntry[]> {
    const docs = await this.model
      .find({ userSub, habit_id: habitId, deleted_at: null })
      .sort({ date: -1 })
      .lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  async findByHabitPaginated(
    userSub: string,
    habitId: string,
    page: number,
    limit: number,
  ): Promise<{ docs: HabitEntry[]; total: number }> {
    const total = await this.model.countDocuments({
      userSub,
      habit_id: habitId,
      deleted_at: null,
    });
    const docs = await this.model
      .find({ userSub, habit_id: habitId, deleted_at: null })
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    return { docs: docs.map((doc) => this.toDomain(doc)), total };
  }

  async findByHabitAndDateRange(
    userSub: string,
    habitId: string,
    startDate: string,
    endDate: string,
  ): Promise<HabitEntry[]> {
    const docs = await this.model
      .find({
        userSub,
        habit_id: habitId,
        date: { $gte: startDate, $lte: endDate },
        deleted_at: null,
      })
      .sort({ date: -1 })
      .lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  async findByUserAndDateRange(
    userSub: string,
    startDate: string,
    endDate: string,
  ): Promise<HabitEntry[]> {
    const docs = await this.model
      .find({
        userSub,
        deleted_at: null,
        date: { $gte: startDate, $lte: endDate },
      })
      .sort({ date: -1 })
      .lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  async delete(userSub: string, id: string): Promise<void> {
    await this.model.updateOne(
      { _id: id, userSub },
      { $set: { deleted_at: new Date() } },
    );
  }

  // Hard-delete every habit entry for the given userSub. Used by the Hub
  // user.deleted cascade. Filtering on userSub is sufficient — each entry
  // doc carries userSub directly, so we don't need to look up habits first.
  async deleteAllForUser(userSub: string): Promise<number> {
    const { deletedCount } = await this.model.deleteMany({ userSub });
    return deletedCount ?? 0;
  }

  async countSkipsByUserAndDate(
    userSub: string,
    date: string,
  ): Promise<number> {
    return this.model.countDocuments({
      userSub,
      date,
      type: "skip",
      deleted_at: null,
    });
  }

  async findUpdatedSince(
    userSub: string,
    since: string,
    includeSoftDeleted = false,
  ): Promise<HabitEntry[]> {
    const filter: any = {
      userSub,
      updated_at: { $gt: new Date(since) },
    };
    if (!includeSoftDeleted) filter.deleted_at = null;
    const docs = await this.model.find(filter).lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  private toDomain(doc: any): HabitEntry {
    const dec = this.encryption.decryptRecord(
      { notes: doc.notes, skip_reason: doc.skip_reason },
      ENCRYPTED_DOC_FIELDS,
    );
    return HabitEntry.reconstitute(
      {
        habitId: doc.habit_id,
        date: doc.date,
        value: doc.value,
        type: doc.type || "completion",
        skipReason: dec.skip_reason,
        notes: dec.notes,
        targetCountSnapshot: doc.target_count_snapshot,
        scheduledDaysSnapshot: doc.scheduled_days_snapshot,
        userSub: doc.userSub,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      },
      doc._id,
    );
  }
}
