import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TodoModel, TodoDocument } from './todo.schema';
import { Todo } from './todo.entity';

@Injectable()
export class TodoRepository {
  constructor(@InjectModel(TodoModel.name) private model: Model<TodoDocument>) {}

  async save(todo: Todo): Promise<void> {
    const data = todo.toObject();
    await this.model.updateOne({ _id: data.id }, { $set: { title: data.title, description: data.description, status: data.status, priority: data.priority, due_date: data.dueDate, list_id: data.listId, workspace_id: data.workspaceId, assignee_id: data.assigneeId, creator_id: data.creatorId, order: data.order } }, { upsert: true });
  }

  async findById(id: string): Promise<Todo | null> {
    const doc = await this.model.findById(id).lean();
    return doc ? this.toDomain(doc) : null;
  }

  async findByList(listId: string): Promise<Todo[]> {
    const docs = await this.model.find({ list_id: listId }).sort({ order: 1 }).lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  async findByWorkspace(workspaceId: string): Promise<Todo[]> {
    const docs = await this.model.find({ workspace_id: workspaceId }).sort({ order: 1 }).lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  async countByList(listId: string): Promise<number> {
    return this.model.countDocuments({ list_id: listId });
  }

  async delete(id: string): Promise<void> { await this.model.deleteOne({ _id: id }); }

  private toDomain(doc: any): Todo {
    return Todo.reconstitute({ title: doc.title, description: doc.description, status: doc.status, priority: doc.priority, dueDate: doc.due_date, listId: doc.list_id, workspaceId: doc.workspace_id, assigneeId: doc.assignee_id, creatorId: doc.creator_id, order: doc.order, createdAt: doc.created_at, updatedAt: doc.updated_at }, doc._id);
  }
}
