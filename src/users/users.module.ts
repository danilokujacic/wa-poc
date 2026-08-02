import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entity/user.entity';
import { Resort } from '../entity/resort.entity';
import { UserRepository } from '../repository/user.repository';
import { ResortRepository } from '../repository/resort.repository';
import { ResortUserController } from './resort-user.controller';
import { UsersController } from './users.controller';
import { ResortUserService } from './resort-user.service';
import { ResortOwnerGuard } from '../resort/guards/resort-owner.guard';
import { ResortMemberGuard } from '../resort/guards/resort-member.guard';
import { ResortOwnerOrSelfGuard } from '../resort/guards/resort-owner-or-self.guard';
import { AuthModule } from '../auth/auth.module';
import { EmailConfirmationModule } from '../email-confirmation/email-confirmation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Resort]),
    AuthModule,
    EmailConfirmationModule,
  ],
  providers: [
    UserRepository,
    ResortRepository,
    ResortUserService,
    ResortOwnerGuard,
    ResortMemberGuard,
    ResortOwnerOrSelfGuard,
  ],
  controllers: [ResortUserController, UsersController],
})
export class UsersModule {}
