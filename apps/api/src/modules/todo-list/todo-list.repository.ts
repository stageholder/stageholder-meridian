import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { TodoListModel, TodoListDocument } from "./todo-list.schema";
import { TodoList } from "./todo-list.entity";
import { EncryptionService } from "../encryption";

const ENCRYPTED_FIELDS = ["name"];

@Injectable()
export class TodoListRepository {
  constructor(
    @InjectModel(TodoListModel.name) private model: Model<TodoListDocument>,
    private readonly encryption: EncryptionService,
  ) {}

  async save(todoList: TodoList): Promise<void> {
    const data = todoList.toObject();
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
          userSub: data.userSub,
          is_default: data.isDefault,
        },
      },
      { upsert: true },
    );
  }

  async findById(userSub: string, id: string): Promise<TodoList | null> {
    const doc = await this.model
      .findOne({ _id: id, userSub, deleted_at: null })
      .lean();
    return doc ? this.toDomain(doc) : null;
  }

  async findByUser(userSub: string): Promise<TodoList[]> {
    const docs = await this.model.find({ userSub, deleted_at: null }).lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  async findDefaultByUser(userSub: string): Promise<TodoList | null> {
    const doc = await this.model
      .findOne({ userSub, is_default: true, deleted_at: null })
      .lean();
    return doc ? this.toDomain(doc) : null;
  }

  /**
   * Counts non-soft-deleted todo lists for a user.
   * Used by entitlement enforcement against the `max_todo_lists` feature limit.
   */
  async countForUser(userSub: string): Promise<number> {
    return this.model.countDocuments({ userSub, deleted_at: null });
  }

  async findByUserPaginated(
    userSub: string,
    page: number,
    limit: number,
  ): Promise<{ docs: TodoList[]; total: number }> {
    const total = await this.model.countDocuments({
      userSub,
      deleted_at: null,
    });
    const docs = await this.model
      .find({ userSub, deleted_at: null })
      .sort({ is_default: -1, created_at: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    return { docs: docs.map((doc) => this.toDomain(doc)), total };
  }

  async delete(userSub: string, id: string): Promise<void> {
    await this.model.updateOne(
      { _id: id, userSub },
      { $set: { deleted_at: new Date() } },
    );
  }

  // Hard-delete every todo list for the given userSub. Used by the Hub
  // user.deleted cascade.
  async deleteAllForUser(userSub: string): Promise<number> {
    const { deletedCount } = await this.model.deleteMany({ userSub });
    return deletedCount ?? 0;
  }

  async findUpdatedSince(
    userSub: string,
    since: string,
    includeSoftDeleted = false,
  ): Promise<TodoList[]> {
    const filter: any = {
      userSub,
      updated_at: { $gt: new Date(since) },
    };
    if (!includeSoftDeleted) filter.deleted_at = null;
    const docs = await this.model.find(filter).lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  private toDomain(doc: any): TodoList {
    const dec = this.encryption.decryptRecord(
      { name: doc.name },
      ENCRYPTED_FIELDS,
    );
    return TodoList.reconstitute(
      {
        name: dec.name,
        color: doc.color,
        icon: doc.icon,
        userSub: doc.userSub,
        isDefault: doc.is_default ?? false,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      },
      doc._id,
    );
  }
}
