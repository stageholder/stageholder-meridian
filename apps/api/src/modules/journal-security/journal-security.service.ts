import {
  Injectable,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  JournalSecurity,
  JournalSecurityDocument,
} from "./journal-security.schema";

const EXPECTED_RECOVERY_CODE_COUNT = 8;

// Argon2id via Bun's native password API. Parameters are pinned explicitly
// (rather than letting Bun's default memoryCost ~ 64 MiB apply) so 8 sequential
// hashes have a predictable memory footprint on Cloud Run. 19 MiB matches
// OWASP's minimum-strength Argon2id profile and remains comfortably out of
// brute-force reach for the 32^8 recovery-code keyspace.
const PASSWORD_HASH_OPTIONS = {
  algorithm: "argon2id" as const,
  memoryCost: 19456,
  timeCost: 2,
};

/**
 * Hash recovery codes one-at-a-time. Argon2id is intentionally memory-hard:
 * issuing 8 hashes via `Promise.all` allocates ~8× the memory cost simul-
 * taneously and is what was OOM-killing the Cloud Run container on
 * `/journal-security/setup` (default 512 MiB instance, 8 × 64 MiB ≈ cap).
 * Sequential is well under 100 ms × 8 ≈ <1 s of wall time and stays inside
 * any reasonable container budget.
 */
async function hashCodesSerially(codes: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const code of codes) {
    out.push(await Bun.password.hash(code, PASSWORD_HASH_OPTIONS));
  }
  return out;
}

export interface SetupPayload {
  passphraseWrappedDek: string;
  passphraseSalt: string;
  recoveryWrappedDek: string;
  recoveryCodes: string[];
}

export interface ChangePassphrasePayload {
  passphraseWrappedDek: string;
  passphraseSalt: string;
}

export interface FinalizeRecoveryPayload {
  passphraseWrappedDek: string;
  passphraseSalt: string;
  recoveryWrappedDek: string;
  recoveryCodes: string[];
}

@Injectable()
export class JournalSecurityService {
  constructor(
    @InjectModel(JournalSecurity.name)
    private readonly model: Model<JournalSecurityDocument>,
  ) {}

  async getKeys(userSub: string): Promise<{
    wrappedDek: string | null;
    salt: string | null;
    encryptionEnabled: boolean;
  }> {
    const doc = await this.model.findById(userSub).lean();
    if (!doc) {
      return { wrappedDek: null, salt: null, encryptionEnabled: false };
    }
    return {
      wrappedDek: doc.passphraseWrappedDek,
      salt: doc.passphraseSalt,
      encryptionEnabled: doc.encryptionEnabled,
    };
  }

  async setup(userSub: string, dto: SetupPayload): Promise<void> {
    if (dto.recoveryCodes.length !== EXPECTED_RECOVERY_CODE_COUNT) {
      throw new BadRequestException(
        `Must provide exactly ${EXPECTED_RECOVERY_CODE_COUNT} recovery codes`,
      );
    }

    const existing = await this.model.findById(userSub).lean();
    if (existing?.encryptionEnabled) {
      throw new ConflictException("Encryption is already set up");
    }

    const hashes = await hashCodesSerially(dto.recoveryCodes);

    await this.model.findByIdAndUpdate(
      userSub,
      {
        _id: userSub,
        encryptionEnabled: true,
        passphraseWrappedDek: dto.passphraseWrappedDek,
        passphraseSalt: dto.passphraseSalt,
        recoveryWrappedDek: dto.recoveryWrappedDek,
        recoveryCodeHashes: hashes,
        recoveryCodesRemaining: EXPECTED_RECOVERY_CODE_COUNT,
      },
      { upsert: true, new: true },
    );
  }

  async changePassphrase(
    userSub: string,
    dto: ChangePassphrasePayload,
  ): Promise<void> {
    const doc = await this.model.findById(userSub);
    if (!doc?.encryptionEnabled) {
      throw new BadRequestException("Encryption is not set up");
    }
    doc.passphraseWrappedDek = dto.passphraseWrappedDek;
    doc.passphraseSalt = dto.passphraseSalt;
    await doc.save();
  }

  async recover(
    userSub: string,
    submittedCodes: string[],
  ): Promise<{ recoveryWrappedDek: string }> {
    if (submittedCodes.length !== EXPECTED_RECOVERY_CODE_COUNT) {
      throw new BadRequestException(
        `Must provide ${EXPECTED_RECOVERY_CODE_COUNT} codes`,
      );
    }
    const doc = await this.model.findById(userSub);
    if (!doc?.encryptionEnabled) {
      throw new BadRequestException("Encryption is not set up");
    }
    if (doc.recoveryCodesRemaining <= 0) {
      throw new UnauthorizedException("Recovery exhausted");
    }

    // Verify ALL codes positionally; never short-circuit so timing leaks nothing.
    // Sequential for the same memory-budget reason as `hashCodesSerially`:
    // Argon2id verify recomputes the hash and is just as memory-hard.
    const results: boolean[] = [];
    for (let i = 0; i < submittedCodes.length; i++) {
      results.push(
        await Bun.password.verify(
          submittedCodes[i]!,
          doc.recoveryCodeHashes[i]!,
        ),
      );
    }
    const allMatch = results.every((ok) => ok === true);
    if (!allMatch) {
      throw new UnauthorizedException("Invalid recovery codes");
    }

    doc.recoveryCodesRemaining = Math.max(0, doc.recoveryCodesRemaining - 1);
    await doc.save();

    return { recoveryWrappedDek: doc.recoveryWrappedDek };
  }

  // Delete the single journal-security doc for the user. One doc per user
  // (keyed by userSub as _id), so deleteOne is enough. Used by the Hub
  // user.deleted cascade.
  async deleteForUser(userSub: string): Promise<void> {
    await this.model.deleteOne({ _id: userSub });
  }

  async finalizeRecovery(
    userSub: string,
    dto: FinalizeRecoveryPayload,
  ): Promise<void> {
    if (dto.recoveryCodes.length !== EXPECTED_RECOVERY_CODE_COUNT) {
      throw new BadRequestException(
        `Must provide exactly ${EXPECTED_RECOVERY_CODE_COUNT} recovery codes`,
      );
    }
    const doc = await this.model.findById(userSub);
    if (!doc) {
      throw new BadRequestException("Encryption is not set up");
    }

    const hashes = await hashCodesSerially(dto.recoveryCodes);

    doc.passphraseWrappedDek = dto.passphraseWrappedDek;
    doc.passphraseSalt = dto.passphraseSalt;
    doc.recoveryWrappedDek = dto.recoveryWrappedDek;
    doc.recoveryCodeHashes = hashes;
    doc.recoveryCodesRemaining = EXPECTED_RECOVERY_CODE_COUNT;
    await doc.save();
  }
}
