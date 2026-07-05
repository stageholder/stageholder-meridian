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

  // Single-use, short-TTL proof that a successful `recover()` just happened.
  // `finalizeRecovery` (which irreversibly overwrites the wrapped DEKs) will
  // only run when a matching, unexpired token is presented, then burns it —
  // so a bare JWT can no longer destroy a user's encrypted journal. sha256 of
  // the token is stored (the token itself is high-entropy, so a fast hash is
  // sufficient); the plaintext token is returned by `recover()` once.
  @Prop({ type: String, default: null })
  recoverySessionHash: string | null;

  @Prop({ type: Date, default: null })
  recoverySessionExpiresAt: Date | null;
}

export const JournalSecuritySchema =
  SchemaFactory.createForClass(JournalSecurity);
