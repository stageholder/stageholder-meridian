import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type JournalSecurityDocument = HydratedDocument<JournalSecurity>;

@Schema({ collection: "journal_security", timestamps: true })
export class JournalSecurity {
  @Prop({ type: String, required: true })
  _id: string; // = userSub (OIDC sub UUID)

  @Prop({ required: true, default: true })
  encryptionEnabled: boolean;

  @Prop({ required: true })
  passphraseWrappedDek: string;

  @Prop({ required: true })
  passphraseSalt: string;

  @Prop({ required: true })
  recoveryWrappedDek: string;

  @Prop({ type: [String], required: true })
  recoveryCodeHashes: string[];

  @Prop({ required: true, default: 8 })
  recoveryCodesRemaining: number;
}

export const JournalSecuritySchema =
  SchemaFactory.createForClass(JournalSecurity);
