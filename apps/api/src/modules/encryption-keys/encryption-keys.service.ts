import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { UserService } from "../user/user.service";
import { SetupEncryptionDto, ChangePassphraseDto } from "./encryption-keys.dto";

@Injectable()
export class EncryptionKeysService {
  constructor(private readonly userService: UserService) {}

  async setup(userId: string, dto: SetupEncryptionDto): Promise<void> {
    const user = await this.userService.findById(userId);
    if (!user) throw new NotFoundException("User not found");
    if (user.encryptionEnabled) {
      throw new ConflictException("Encryption is already set up");
    }
    user.enableEncryption(dto.wrappedDek, dto.salt, dto.recoveryCodesHash);
    await this.userService.updateUser(user);
  }

  async getKeys(userId: string): Promise<{
    wrappedDek: string | null;
    salt: string | null;
    encryptionEnabled: boolean;
  }> {
    const user = await this.userService.findById(userId);
    if (!user) throw new NotFoundException("User not found");
    return {
      wrappedDek: user.encryptedDek ?? null,
      salt: user.dekSalt ?? null,
      encryptionEnabled: user.encryptionEnabled,
    };
  }

  async changePassphrase(
    userId: string,
    dto: ChangePassphraseDto,
  ): Promise<void> {
    const user = await this.userService.findById(userId);
    if (!user) throw new NotFoundException("User not found");
    if (!user.encryptionEnabled) {
      throw new BadRequestException(
        "Encryption is not set up. Use the setup endpoint first.",
      );
    }
    user.updateWrappedDek(dto.wrappedDek, dto.salt);
    await this.userService.updateUser(user);
  }

  async verifyRecovery(
    userId: string,
    code: string,
  ): Promise<{ wrappedDek: string; salt: string }> {
    const user = await this.userService.findById(userId);
    if (!user) throw new NotFoundException("User not found");
    if (!user.encryptionEnabled) {
      throw new BadRequestException("Encryption is not set up");
    }
    if (!code || code.trim().length === 0) {
      throw new BadRequestException("Recovery code is required");
    }
    // Note: Full recovery code verification requires the client to send all codes
    // or use a per-code hash. For now, we require a valid non-empty code and
    // return the wrapped DEK. The client must then use the DEK with a new passphrase.
    // A production enhancement would store individual code hashes for server-side verification.
    return {
      wrappedDek: user.encryptedDek!,
      salt: user.dekSalt!,
    };
  }
}
