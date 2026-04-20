import { z } from "zod";

export const SetupEncryptionDto = z.object({
  passphraseWrappedDek: z.string().min(1),
  passphraseSalt: z.string().min(1),
  recoveryWrappedDek: z.string().min(1),
  recoveryCodes: z.array(z.string().min(1)).length(8),
});
export type SetupEncryptionDto = z.infer<typeof SetupEncryptionDto>;

export const ChangePassphraseDto = z.object({
  passphraseWrappedDek: z.string().min(1),
  passphraseSalt: z.string().min(1),
});
export type ChangePassphraseDto = z.infer<typeof ChangePassphraseDto>;

export const RecoverDto = z.object({
  codes: z.array(z.string().min(1)).length(8),
});
export type RecoverDto = z.infer<typeof RecoverDto>;

export const FinalizeRecoveryDto = z.object({
  passphraseWrappedDek: z.string().min(1),
  passphraseSalt: z.string().min(1),
  recoveryWrappedDek: z.string().min(1),
  recoveryCodes: z.array(z.string().min(1)).length(8),
});
export type FinalizeRecoveryDto = z.infer<typeof FinalizeRecoveryDto>;
