import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { TodoModel, TodoDocument } from "./todo.schema";
import { Todo } from "./todo.entity";
import { EncryptionService } from "../encryption";

const ENCRYPTED_FIELDS = ["title", "description", "subtasks[*].title"];

@Injectable()
export class TodoRepository {
  constructor(
    @InjectModel(TodoModel.name) private model: Model<TodoDocument>,
    private readonly encryption: EncryptionService,
  ) {}

  async save(todo: Todo): Promise<void> {
    const data = todo.toObject();
    const enc = this.encryption.encryptRecord(
      {
        title: data.title,
        description: data.description,
        subtasks: (data.subtasks || []).map((s: any) => ({
          ...s,
          title: s.title,
        })),
      },
      ENCRYPTED_FIELDS,
    );
    await this.model.updateOne(
      { _id: data.id },
      {
        $set: {
          title: enc.title,
          description: enc.description ?? null,
          status: data.status,
          priority: data.priority,
          due_date: data.dueDate ?? null,
          do_date: data.doDate ?? null,
          list_id: data.listId,
          userSub: data.userSub,
          order: data.order,
          subtasks: (enc.subtasks || []).map((s: any) => ({
            _id: s.id,
            title: s.title,
            status: s.status,
            priority: s.priority,
            order: s.order,
            created_at: s.createdAt,
            updated_at: s.updatedAt,
          })),
        },
      },
      { upsert: true },
    );
  }

  async findById(userSub: string, id: string): Promise<Todo | null> {
    const doc = await this.model
      .findOne({ _id: id, userSub, deleted_at: null })
      .lean();
    return doc ? this.toDomain(doc) : null;
  }

  async findByList(userSub: string, listId: string): Promise<Todo[]> {
    const docs = await this.model
      .find({ userSub, list_id: listId, deleted_at: null })
      .sort({ order: 1 })
      .lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  async findByUser(userSub: string): Promise<Todo[]> {
    const docs = await this.model
      .find({ userSub, deleted_at: null })
      .sort({ order: 1 })
      .lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  async findByUserAndDateRange(
    userSub: string,
    startDate: string,
    endDate: string,
  ): Promise<Todo[]> {
    const nextDay = new Date(endDate);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const endExclusive = nextDay.toISOString().split("T")[0]!;
    const dateRange = { $gte: startDate, $lt: endExclusive };
    const docs = await this.model
      .find({
        userSub,
        deleted_at: null,
        $or: [{ due_date: dateRange }, { do_date: dateRange }],
      })
      .sort({ due_date: 1 })
      .lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  async findByUserPaginated(
    userSub: string,
    page: number,
    limit: number,
  ): Promise<{ docs: Todo[]; total: number }> {
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

  async countByList(userSub: string, listId: string): Promise<number> {
    return this.model.countDocuments({
      userSub,
      list_id: listId,
      deleted_at: null,
    });
  }

  /**
   * Counts active (non-done, non-soft-deleted) todos for a user.
   * Used by entitlement enforcement against the `max_active_todos` feature limit.
   */
  async countActiveForUser(userSub: string): Promise<number> {
    return this.model.countDocuments({
      userSub,
      deleted_at: null,
      status: { $ne: "done" },
    });
  }

  async delete(userSub: string, id: string): Promise<void> {
    await this.model.updateOne(
      { _id: id, userSub },
      { $set: { deleted_at: new Date() } },
    );
  }

  async deleteByList(userSub: string, listId: string): Promise<void> {
    await this.model.updateMany(
      { userSub, list_id: listId, deleted_at: null },
      { $set: { deleted_at: new Date() } },
    );
  }

  // Hard-delete every todo for the given userSub. Used by the Hub
  // user.deleted cascade.
  async deleteAllForUser(userSub: string): Promise<number> {
    const { deletedCount } = await this.model.deleteMany({ userSub });
    return deletedCount ?? 0;
  }

  async findUpdatedSince(
    userSub: string,
    since: string,
    includeSoftDeleted = false,
  ): Promise<Todo[]> {
    const filter: any = {
      userSub,
      updated_at: { $gt: new Date(since) },
    };
    if (!includeSoftDeleted) filter.deleted_at = null;
    const docs = await this.model.find(filter).lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  private toDomain(doc: any): Todo {
    const dec = this.encryption.decryptRecord(
      {
        title: doc.title,
        description: doc.description,
        subtasks: doc.subtasks || [],
      },
      ENCRYPTED_FIELDS,
    );
    return Todo.reconstitute(
      {
        title: dec.title,
        description: dec.description ?? undefined,
        status: doc.status,
        priority: doc.priority,
        dueDate: doc.due_date ?? undefined,
        doDate: doc.do_date ?? undefined,
        listId: doc.list_id,
        userSub: doc.userSub,
        order: doc.order,
        subtasks: (dec.subtasks || []).map((s: any) => ({
          id: s._id,
          title: s.title,
          status: s.status,
          priority: s.priority,
          order: s.order,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
        })),
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      },
      doc._id,
    );
  }
}
