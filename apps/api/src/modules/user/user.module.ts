import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { UserModel, UserSchema } from "./user.schema";
import { UserRepository } from "./user.repository";
import { UserService } from "./user.service";
import { LegacyMigrationService } from "./legacy-migration.service";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: UserModel.name, schema: UserSchema }]),
  ],
  providers: [UserRepository, UserService, LegacyMigrationService],
  exports: [UserService],
})
export class UserModule {}
