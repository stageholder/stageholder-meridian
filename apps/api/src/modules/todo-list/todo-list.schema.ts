import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { randomUUID } from "crypto";

export type TodoListDocument = TodoListModel & Document<string>;

@Schema({
  collection: "todo_lists",
  timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  toJSON: {
    transform: (_doc: any, ret: any) => {
      ret.id = ret._id;
      delete ret.__v;
      return ret;
    },
  },
})
export class TodoListModel {
  @Prop({ type: String, default: () => randomUUID() }) _id: string;
  @Prop({ type: String, required: true, trim: true }) name: string;
  @Prop({ type: String }) color: string;
  @Prop({ type: String }) icon: string;
  @Prop({ type: String, required: true, index: true }) workspace_id: string;
  @Prop({ type: Boolean, default: false }) is_shared: boolean;
  @Prop({ type: Boolean, default: false }) is_default: boolean;
  @Prop({ type: String, required: true }) creator_id: string;
  @Prop({ type: Date, default: null }) deleted_at: Date;
}

export const TodoListSchema = SchemaFactory.createForClass(TodoListModel);

TodoListSchema.index(
  { workspace_id: 1, is_default: 1 },
  {
    unique: true,
    partialFilterExpression: { is_default: true, deleted_at: null },
  },
);
