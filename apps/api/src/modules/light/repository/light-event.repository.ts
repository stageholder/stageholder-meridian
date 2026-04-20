import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { LightEventModel, LightEventDocument } from "../light-event.schema";
import { LightEvent } from "../domain/light-event.entity";

@Injectable()
export class LightEventRepository {
  constructor(
    @InjectModel(LightEventModel.name) private model: Model<LightEventDocument>,
  ) {}

  async save(event: LightEvent): Promise<void> {
    const data = event.toObject();
    await this.model.updateOne(
      { _id: data.id },
      {
        $set: {
          userSub: data.userSub,
          action: data.action,
          base_light: data.baseLight,
          multiplier: data.multiplier,
          total_light: data.totalLight,
          date: data.date,
          metadata: data.metadata,
        },
      },
      { upsert: true },
    );
  }

  async findByUser(
    userSub: string,
    limit: number,
    offset: number,
  ): Promise<{ docs: LightEvent[]; total: number }> {
    const total = await this.model.countDocuments({
      userSub,
      deleted_at: null,
    });
    const docs = await this.model
      .find({ userSub, deleted_at: null })
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limit)
      .lean();
    return { docs: docs.map((doc) => this.toDomain(doc)), total };
  }

  async existsForEntityOnDate(
    userSub: string,
    action: string,
    date: string,
    entityId: string,
  ): Promise<boolean> {
    const doc = await this.model
      .findOne({
        userSub,
        action,
        date,
        "metadata.entityId": entityId,
        deleted_at: null,
      })
      .lean();
    return !!doc;
  }

  async countByUserActionDate(
    userSub: string,
    action: string,
    date: string,
  ): Promise<number> {
    return this.model.countDocuments({
      userSub,
      action,
      date,
      deleted_at: null,
    });
  }

  async getGrowthStats(
    userSub: string,
    windowStart: string,
  ): Promise<{
    window: Array<{ date: string; light: number }>;
    baseline: { light: number };
  }> {
    const result = await this.model.aggregate([
      { $match: { userSub, deleted_at: null } },
      {
        $facet: {
          window: [
            { $match: { date: { $gte: windowStart } } },
            {
              $group: {
                _id: "$date",
                light: { $sum: "$total_light" },
              },
            },
            { $sort: { _id: 1 } },
          ],
          baseline: [
            { $match: { date: { $lt: windowStart } } },
            {
              $group: {
                _id: null,
                light: { $sum: "$total_light" },
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
        light: d.light,
      })),
      baseline: facet.baseline[0]
        ? { light: facet.baseline[0].light }
        : { light: 0 },
    };
  }

  // Hard-delete every light event for the given userSub. Used by the Hub
  // user.deleted cascade.
  async deleteAllForUser(userSub: string): Promise<number> {
    const { deletedCount } = await this.model.deleteMany({ userSub });
    return deletedCount ?? 0;
  }

  private toDomain(doc: any): LightEvent {
    return LightEvent.reconstitute(
      {
        userSub: doc.userSub,
        action: doc.action,
        baseLight: doc.base_light,
        multiplier: doc.multiplier,
        totalLight: doc.total_light,
        date: doc.date,
        metadata: doc.metadata,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      },
      doc._id,
    );
  }
}
