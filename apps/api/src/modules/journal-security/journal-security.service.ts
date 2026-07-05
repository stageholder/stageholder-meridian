import {
  Injectable,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { randomBytes, createHash } from "crypto";
import {
  JournalSecurity,
  JournalSecurityDocument,
} from "./journal-security.schema";

const EXPECTED_RECOVERY_CODE_COUNT = 8;

// The recovery-session token proves `recover()` just succeeded; `finalize`
// must run within this window or the user recovers again.
const RECOVERY_SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("base64");
}

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
  // Single-use proof returned by a prior `recover()` in this flow.
  recoverySession: string;
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
  ): Promise<{ recoveryWrappedDek: string; recoverySession: string }> {
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

    // Mint a single-use, short-TTL session token gating the destructive
    // finalize step. Only its hash is stored; the plaintext is returned once.
    const recoverySession = randomBytes(32).toString("base64url");
    doc.recoveryCodesRemaining = Math.max(0, doc.recoveryCodesRemaining - 1);
    doc.recoverySessionHash = hashToken(recoverySession);
    doc.recoverySessionExpiresAt = new Date(
      Date.now() + RECOVERY_SESSION_TTL_MS,
    );
    await doc.save();

    return { recoveryWrappedDek: doc.recoveryWrappedDek, recoverySession };
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

    // Require a valid, unexpired recovery-session token from a prior recover().
    // Without this, any bearer JWT could overwrite (and thus destroy) the
    // wrapped DEKs — the server can't decrypt to validate, so proof-of-recovery
    // is the only guard. Burn the token after use (single-use).
    if (
      !doc.recoverySessionHash ||
      !doc.recoverySessionExpiresAt ||
      doc.recoverySessionExpiresAt.getTime() < Date.now() ||
      doc.recoverySessionHash !== hashToken(dto.recoverySession)
    ) {
      throw new UnauthorizedException(
        "Recovery session is missing, expired, or invalid — recover again",
      );
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
    // Burn the session so it can't be replayed.
    doc.recoverySessionHash = null;
    doc.recoverySessionExpiresAt = null;
    await doc.save();
  }
}
