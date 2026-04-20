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

// Argon2id via Bun's native password API. Parameters match Bun's default
// argon2id profile which is comparable to OWASP's recommended memory cost.
// Adequate for low-entropy recovery codes against a DB-leak threat model.
const PASSWORD_HASH_OPTIONS = { algorithm: "argon2id" as const };

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

    const hashes = await Promise.all(
      dto.recoveryCodes.map((code) =>
        Bun.password.hash(code, PASSWORD_HASH_OPTIONS),
      ),
    );

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
    const results = await Promise.all(
      submittedCodes.map((code, i) =>
        Bun.password.verify(code, doc.recoveryCodeHashes[i]!),
      ),
    );
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

    const hashes = await Promise.all(
      dto.recoveryCodes.map((code) =>
        Bun.password.hash(code, PASSWORD_HASH_OPTIONS),
      ),
    );

    doc.passphraseWrappedDek = dto.passphraseWrappedDek;
    doc.passphraseSalt = dto.passphraseSalt;
    doc.recoveryWrappedDek = dto.recoveryWrappedDek;
    doc.recoveryCodeHashes = hashes;
    doc.recoveryCodesRemaining = EXPECTED_RECOVERY_CODE_COUNT;
    await doc.save();
  }
}
