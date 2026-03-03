import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModel, UserSchema } from '../user/user.schema';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    UserModule,
    MongooseModule.forFeature([{ name: UserModel.name, schema: UserSchema }]),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
