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
          workspace_id: data.workspaceId,
          assignee_id: data.assigneeId ?? null,
          creator_id: data.creatorId,
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

  async findById(id: string): Promise<Todo | null> {
    const doc = await this.model
      .findById(id)
      .where({ deleted_at: null })
      .lean();
    return doc ? this.toDomain(doc) : null;
  }

  async findByList(listId: string): Promise<Todo[]> {
    const docs = await this.model
      .find({ list_id: listId, deleted_at: null })
      .sort({ order: 1 })
      .lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  async findByWorkspace(workspaceId: string): Promise<Todo[]> {
    const docs = await this.model
      .find({ workspace_id: workspaceId, deleted_at: null })
      .sort({ order: 1 })
      .lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  async findByWorkspaceAndDateRange(
    workspaceId: string,
    startDate: string,
    endDate: string,
  ): Promise<Todo[]> {
    const nextDay = new Date(endDate);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const endExclusive = nextDay.toISOString().split("T")[0]!;
    const dateRange = { $gte: startDate, $lt: endExclusive };
    const docs = await this.model
      .find({
        workspace_id: workspaceId,
        deleted_at: null,
        $or: [{ due_date: dateRange }, { do_date: dateRange }],
      })
      .sort({ due_date: 1 })
      .lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  async findByWorkspacePaginated(
    workspaceId: string,
    page: number,
    limit: number,
  ): Promise<{ docs: Todo[]; total: number }> {
    const total = await this.model.countDocuments({
      workspace_id: workspaceId,
      deleted_at: null,
    });
    const docs = await this.model
      .find({ workspace_id: workspaceId, deleted_at: null })
      .sort({ created_at: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    return { docs: docs.map((doc) => this.toDomain(doc)), total };
  }

  async countByList(listId: string): Promise<number> {
    return this.model.countDocuments({ list_id: listId, deleted_at: null });
  }

  async delete(id: string): Promise<void> {
    await this.model.updateOne(
      { _id: id },
      { $set: { deleted_at: new Date() } },
    );
  }

  async deleteByList(listId: string): Promise<void> {
    await this.model.updateMany(
      { list_id: listId, deleted_at: null },
      { $set: { deleted_at: new Date() } },
    );
  }

  async findUpdatedSince(
    workspaceId: string,
    since: string,
    includeSoftDeleted = false,
  ): Promise<Todo[]> {
    const filter: any = {
      workspace_id: workspaceId,
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
        workspaceId: doc.workspace_id,
        assigneeId: doc.assignee_id ?? undefined,
        creatorId: doc.creator_id,
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
