import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { HabitGroupModel, HabitGroupDocument } from "./habit-group.schema";
import { HabitGroup } from "./habit-group.entity";
import { EncryptionService } from "../encryption";

const ENCRYPTED_FIELDS = ["name"];

@Injectable()
export class HabitGroupRepository {
  constructor(
    @InjectModel(HabitGroupModel.name) private model: Model<HabitGroupDocument>,
    private readonly encryption: EncryptionService,
  ) {}

  async save(group: HabitGroup): Promise<void> {
    const data = group.toObject();
    const enc = this.encryption.encryptRecord(
      { name: data.name },
      ENCRYPTED_FIELDS,
    );
    await this.model.updateOne(
      { _id: data.id },
      {
        $set: {
          name: enc.name,
          color: data.color,
          icon: data.icon,
          order: data.order,
          userSub: data.userSub,
        },
      },
      { upsert: true },
    );
  }

  async findById(userSub: string, id: string): Promise<HabitGroup | null> {
    const doc = await this.model
      .findOne({ _id: id, userSub, deleted_at: null })
      .lean();
    return doc ? this.toDomain(doc) : null;
  }

  async findByUser(userSub: string): Promise<HabitGroup[]> {
    const docs = await this.model
      .find({ userSub, deleted_at: null })
      .sort({ order: 1, created_at: 1 })
      .lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  /** Counts non-soft-deleted groups — used for entitlement enforcement. */
  async countForUser(userSub: string): Promise<number> {
    return this.model.countDocuments({ userSub, deleted_at: null });
  }

  /**
   * Counts ALL groups for the user INCLUDING soft-deleted. The time-of-day
   * seed runs only when this is zero, so deleting every group does not
   * re-spawn the four defaults on the next fetch.
   */
  async countAllForUser(userSub: string): Promise<number> {
    return this.model.countDocuments({ userSub });
  }

  /**
   * Idempotently seed a default group keyed on a deterministic _id, so
   * concurrent first-loads (PWA + mobile) cannot create duplicates. `name`
   * is AES-256-GCM encrypted (non-deterministic ciphertext), so a unique-name
   * index can't dedupe — the stable _id + $setOnInsert does. Re-running after
   * the user soft-deletes a seed is a no-op (the _id still exists; $setOnInsert
   * doesn't fire on match, so deleted seeds are NOT resurrected).
   */
  async seedDefault(
    userSub: string,
    seedKey: string,
    data: { name: string; color: string; icon: string; order: number },
  ): Promise<void> {
    const enc = this.encryption.encryptRecord(
      { name: data.name },
      ENCRYPTED_FIELDS,
    );
    await this.model.updateOne(
      { _id: `hg-seed-${userSub}-${seedKey}` },
      {
        $setOnInsert: {
          name: enc.name,
          color: data.color,
          icon: data.icon,
          order: data.order,
          userSub,
        },
      },
      { upsert: true },
    );
  }

  async delete(userSub: string, id: string): Promise<void> {
    await this.model.updateOne(
      { _id: id, userSub },
      { $set: { deleted_at: new Date() } },
    );
  }

  async deleteAllForUser(userSub: string): Promise<number> {
    const { deletedCount } = await this.model.deleteMany({ userSub });
    return deletedCount ?? 0;
  }

  async findUpdatedSince(
    userSub: string,
    since: string,
    includeSoftDeleted = false,
  ): Promise<HabitGroup[]> {
    const filter: any = { userSub, updated_at: { $gt: new Date(since) } };
    if (!includeSoftDeleted) filter.deleted_at = null;
    const docs = await this.model.find(filter).lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  private toDomain(doc: any): HabitGroup {
    const dec = this.encryption.decryptRecord(
      { name: doc.name },
      ENCRYPTED_FIELDS,
    );
    return HabitGroup.reconstitute(
      {
        name: dec.name,
        color: doc.color,
        icon: doc.icon,
        order: doc.order ?? 0,
        userSub: doc.userSub,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      },
      doc._id,
    );
  }
}
