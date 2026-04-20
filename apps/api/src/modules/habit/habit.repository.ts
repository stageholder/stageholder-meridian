import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { HabitModel, HabitDocument } from "./habit.schema";
import { Habit } from "./habit.entity";
import { EncryptionService } from "../encryption";

const ENCRYPTED_FIELDS = ["name", "description"];

@Injectable()
export class HabitRepository {
  constructor(
    @InjectModel(HabitModel.name) private model: Model<HabitDocument>,
    private readonly encryption: EncryptionService,
  ) {}

  async save(habit: Habit): Promise<void> {
    const data = habit.toObject();
    const enc = this.encryption.encryptRecord(
      { name: data.name, description: data.description },
      ENCRYPTED_FIELDS,
    );
    await this.model.updateOne(
      { _id: data.id },
      {
        $set: {
          name: enc.name,
          description: enc.description,
          frequency: data.frequency,
          target_count: data.targetCount,
          scheduled_days: data.scheduledDays,
          unit: data.unit,
          color: data.color,
          icon: data.icon,
          userSub: data.userSub,
        },
      },
      { upsert: true },
    );
  }

  async findById(userSub: string, id: string): Promise<Habit | null> {
    const doc = await this.model
      .findOne({ _id: id, userSub, deleted_at: null })
      .lean();
    return doc ? this.toDomain(doc) : null;
  }

  async findByUser(userSub: string): Promise<Habit[]> {
    const docs = await this.model.find({ userSub, deleted_at: null }).lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  async findByUserPaginated(
    userSub: string,
    page: number,
    limit: number,
  ): Promise<{ docs: Habit[]; total: number }> {
    const total = await this.model.countDocuments({
      userSub,
      deleted_at: null,
    });
    const docs = await this.model
      .find({ userSub, deleted_at: null })
      .sort({ created_at: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    return { docs: docs.map((doc) => this.toDomain(doc)), total };
  }

  async countByUser(userSub: string): Promise<number> {
    return this.model.countDocuments({ userSub, deleted_at: null });
  }

  /**
   * Counts active (non-soft-deleted) habits for a user.
   * Used by entitlement enforcement against the `max_habits` feature limit.
   * The habit schema has no `archived` field, so "active" == not soft-deleted.
   */
  async countActiveForUser(userSub: string): Promise<number> {
    return this.model.countDocuments({ userSub, deleted_at: null });
  }

  async findIdsByUser(userSub: string): Promise<string[]> {
    const docs = await this.model
      .find({ userSub, deleted_at: null })
      .select("_id")
      .lean();
    return docs.map((d) => d._id as string);
  }

  /**
   * Returns habit IDs for the user that existed on or before the given date.
   * Prevents newly created habits from retroactively inflating a previous
   * day's ring completion check.
   */
  async findIdsByUserBefore(
    userSub: string,
    beforeDate: string,
  ): Promise<string[]> {
    const endOfDay = new Date(beforeDate + "T23:59:59.999");
    const docs = await this.model
      .find({
        userSub,
        deleted_at: null,
        created_at: { $lte: endOfDay },
      })
      .select("_id")
      .lean();
    return docs.map((d) => d._id as string);
  }

  async delete(userSub: string, id: string): Promise<void> {
    await this.model.updateOne(
      { _id: id, userSub },
      { $set: { deleted_at: new Date() } },
    );
  }

  // Hard-delete every habit for the given userSub. Used by the Hub
  // user.deleted cascade.
  async deleteAllForUser(userSub: string): Promise<number> {
    const { deletedCount } = await this.model.deleteMany({ userSub });
    return deletedCount ?? 0;
  }

  async findUpdatedSince(
    userSub: string,
    since: string,
    includeSoftDeleted = false,
  ): Promise<Habit[]> {
    const filter: any = {
      userSub,
      updated_at: { $gt: new Date(since) },
    };
    if (!includeSoftDeleted) filter.deleted_at = null;
    const docs = await this.model.find(filter).lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  private toDomain(doc: any): Habit {
    const dec = this.encryption.decryptRecord(
      { name: doc.name, description: doc.description },
      ENCRYPTED_FIELDS,
    );
    return Habit.reconstitute(
      {
        name: dec.name,
        description: dec.description,
        frequency: doc.frequency,
        targetCount: doc.target_count,
        scheduledDays: doc.scheduled_days,
        unit: doc.unit,
        color: doc.color,
        icon: doc.icon,
        userSub: doc.userSub,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      },
      doc._id,
    );
  }
}
