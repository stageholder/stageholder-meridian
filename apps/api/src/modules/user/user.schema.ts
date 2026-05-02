import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { randomUUID } from "crypto";

export type UserDocument = UserModel & Document<string>;

@Schema({
  collection: "users",
  timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  toJSON: {
    transform: (_doc: any, ret: any) => {
      ret.id = ret._id;
      delete ret.__v;
      return ret;
    },
  },
})
export class UserModel {
  @Prop({ type: String, default: () => randomUUID() }) _id: string;
  @Prop({ type: String, required: true, unique: true, index: true })
  sub: string;
  @Prop({ type: Boolean, required: true, default: false })
  has_completed_onboarding: boolean;
}

export const UserSchema = SchemaFactory.createForClass(UserModel);
