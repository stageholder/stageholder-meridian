import { z } from "zod";

export const SetupEncryptionDto = z.object({
  wrappedDek: z.string().min(1, "Wrapped DEK is required"),
  salt: z.string().min(1, "Salt is required"),
  recoveryCodesHash: z.string().min(1, "Recovery codes hash is required"),
});
export type SetupEncryptionDto = z.infer<typeof SetupEncryptionDto>;

export const ChangePassphraseDto = z.object({
  wrappedDek: z.string().min(1, "Wrapped DEK is required"),
  salt: z.string().min(1, "Salt is required"),
});
export type ChangePassphraseDto = z.infer<typeof ChangePassphraseDto>;

export const VerifyRecoveryDto = z.object({
  code: z.string().min(1, "Recovery code is required"),
});
export type VerifyRecoveryDto = z.infer<typeof VerifyRecoveryDto>;
