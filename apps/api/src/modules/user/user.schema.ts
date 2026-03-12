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
      delete ret.password_hash;
      delete ret.refresh_token_hash;
      return ret;
    },
  },
})
export class UserModel {
  @Prop({ type: String, default: () => randomUUID() }) _id: string;
  @Prop({
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  })
  email: string;
  @Prop({ type: String, required: true, trim: true }) name: string;
  @Prop({ type: String }) password_hash: string;
  @Prop({
    type: String,
    required: true,
    enum: ["local", "google"],
    default: "local",
  })
  provider: string;
  @Prop({ type: String }) provider_id: string;
  @Prop({ type: Boolean, default: false }) email_verified: boolean;
  @Prop({ type: String }) avatar: string;
  @Prop({ type: String }) timezone: string;
  @Prop({ type: Boolean, default: false }) onboarding_completed: boolean;
  @Prop({ type: String }) refresh_token_hash: string;
  @Prop({ type: Date, default: null }) deleted_at: Date;
}

export const UserSchema = SchemaFactory.createForClass(UserModel);
UserSchema.index({ provider: 1, provider_id: 1 }, { sparse: true });
