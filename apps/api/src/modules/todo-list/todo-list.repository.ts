import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { TodoListModel, TodoListDocument } from "./todo-list.schema";
import { TodoList } from "./todo-list.entity";

@Injectable()
export class TodoListRepository {
  constructor(
    @InjectModel(TodoListModel.name) private model: Model<TodoListDocument>,
  ) {}

  async save(todoList: TodoList): Promise<void> {
    const data = todoList.toObject();
    await this.model.updateOne(
      { _id: data.id },
      {
        $set: {
          name: data.name,
          color: data.color,
          icon: data.icon,
          workspace_id: data.workspaceId,
          is_shared: data.isShared,
          is_default: data.isDefault,
          creator_id: data.creatorId,
        },
      },
      { upsert: true },
    );
  }

  async findById(id: string): Promise<TodoList | null> {
    const doc = await this.model
      .findById(id)
      .where({ deleted_at: null })
      .lean();
    return doc ? this.toDomain(doc) : null;
  }

  async findByWorkspace(workspaceId: string): Promise<TodoList[]> {
    const docs = await this.model
      .find({ workspace_id: workspaceId, deleted_at: null })
      .lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  async findDefaultByWorkspace(workspaceId: string): Promise<TodoList | null> {
    const doc = await this.model
      .findOne({
        workspace_id: workspaceId,
        is_default: true,
        deleted_at: null,
      })
      .lean();
    return doc ? this.toDomain(doc) : null;
  }

  async findByWorkspacePaginated(
    workspaceId: string,
    page: number,
    limit: number,
  ): Promise<{ docs: TodoList[]; total: number }> {
    const total = await this.model.countDocuments({
      workspace_id: workspaceId,
      deleted_at: null,
    });
    const docs = await this.model
      .find({ workspace_id: workspaceId, deleted_at: null })
      .sort({ is_default: -1, created_at: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    return { docs: docs.map((doc) => this.toDomain(doc)), total };
  }

  async delete(id: string): Promise<void> {
    await this.model.updateOne(
      { _id: id },
      { $set: { deleted_at: new Date() } },
    );
  }

  async findUpdatedSince(
    workspaceId: string,
    since: string,
    includeSoftDeleted = false,
  ): Promise<TodoList[]> {
    const filter: any = {
      workspace_id: workspaceId,
      updated_at: { $gt: new Date(since) },
    };
    if (!includeSoftDeleted) filter.deleted_at = null;
    const docs = await this.model.find(filter).lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  private toDomain(doc: any): TodoList {
    return TodoList.reconstitute(
      {
        name: doc.name,
        color: doc.color,
        icon: doc.icon,
        workspaceId: doc.workspace_id,
        isShared: doc.is_shared,
        isDefault: doc.is_default ?? false,
        creatorId: doc.creator_id,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      },
      doc._id,
    );
  }
}
