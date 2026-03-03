import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TodoListModel, TodoListDocument } from './todo-list.schema';
import { TodoList } from './todo-list.entity';

@Injectable()
export class TodoListRepository {
  constructor(@InjectModel(TodoListModel.name) private model: Model<TodoListDocument>) {}

  async save(todoList: TodoList): Promise<void> {
    const data = todoList.toObject();
    await this.model.updateOne({ _id: data.id }, { $set: { name: data.name, color: data.color, icon: data.icon, workspace_id: data.workspaceId, is_shared: data.isShared, creator_id: data.creatorId } }, { upsert: true });
  }

  async findById(id: string): Promise<TodoList | null> {
    const doc = await this.model.findById(id).lean();
    return doc ? this.toDomain(doc) : null;
  }

  async findByWorkspace(workspaceId: string): Promise<TodoList[]> {
    const docs = await this.model.find({ workspace_id: workspaceId }).lean();
    return docs.map((doc) => this.toDomain(doc));
  }

  async delete(id: string): Promise<void> { await this.model.deleteOne({ _id: id }); }

  private toDomain(doc: any): TodoList {
    return TodoList.reconstitute({ name: doc.name, color: doc.color, icon: doc.icon, workspaceId: doc.workspace_id, isShared: doc.is_shared, creatorId: doc.creator_id, createdAt: doc.created_at, updatedAt: doc.updated_at }, doc._id);
  }
}
