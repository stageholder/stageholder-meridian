import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema as MongooseSchema } from "mongoose";
import { randomUUID } from "crypto";

export type TodoDocument = TodoModel & Document<string>;

const SubtaskSchema = new MongooseSchema(
  {
    _id: { type: String, required: true },
    title: { type: String, required: true },
    status: { type: String, required: true, default: "todo" },
    priority: { type: String, required: true, default: "none" },
    order: { type: Number, required: true, default: 0 },
    created_at: { type: String },
    updated_at: { type: String },
  },
  { _id: false },
);

@Schema({
  collection: "todos",
  timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  toJSON: {
    transform: (_doc: any, ret: any) => {
      ret.id = ret._id;
      delete ret.__v;
      return ret;
    },
  },
})
export class TodoModel {
  @Prop({ type: String, default: () => randomUUID() }) _id: string;
  @Prop({ type: String, required: true, trim: true }) title: string;
  @Prop({ type: String }) description: string;
  @Prop({ type: String, required: true, index: true, default: "todo" })
  status: string;
  @Prop({ type: String, required: true, default: "none" }) priority: string;
  @Prop({ type: String, index: true }) due_date: string;
  @Prop({ type: String, index: true }) do_date: string;
  @Prop({ type: String, required: true, index: true }) list_id: string;
  @Prop({ type: String, required: true, index: true }) userSub: string;
  @Prop({ type: Number, default: 0 }) order: number;
  @Prop({ type: [SubtaskSchema], default: [] }) subtasks: any[];
  @Prop({ type: Date, default: null }) deleted_at: Date;
}

export const TodoSchema = SchemaFactory.createForClass(TodoModel);
TodoSchema.index({ userSub: 1, list_id: 1, status: 1 });
TodoSchema.index({ userSub: 1, due_date: 1 });
TodoSchema.index({ userSub: 1, do_date: 1 });
