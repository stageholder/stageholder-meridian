import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { randomUUID } from 'crypto';

export type HabitEntryDocument = HabitEntryModel & Document<string>;

@Schema({
  collection: 'habit_entries',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: { transform: (_doc: any, ret: any) => { ret.id = ret._id; delete ret.__v; return ret; } },
})
export class HabitEntryModel {
  @Prop({ type: String, default: () => randomUUID() }) _id: string;
  @Prop({ type: String, required: true, index: true }) habit_id: string;
  @Prop({ type: String, required: true }) date: string;
  @Prop({ type: Number, required: true }) value: number;
  @Prop({ type: String }) notes: string;
  @Prop({ type: String, required: true, index: true }) workspace_id: string;
}

export const HabitEntrySchema = SchemaFactory.createForClass(HabitEntryModel);
HabitEntrySchema.index({ habit_id: 1, date: 1 }, { unique: true });
