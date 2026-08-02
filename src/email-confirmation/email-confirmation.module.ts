import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailConfirmation } from '../entity/email-confirmation.entity';
import { User } from '../entity/user.entity';
import { EmailConfirmationRepository } from '../repository/email-confirmation.repository';
import { EmailConfirmationService } from './email-confirmation.service';
import { EmailConfirmationController } from './email-confirmation.controller';
import { EmailConfirmationCleanupScheduler } from './email-confirmation-cleanup.scheduler';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [TypeOrmModule.forFeature([EmailConfirmation, User]), MailModule],
  providers: [
    EmailConfirmationRepository,
    EmailConfirmationService,
    EmailConfirmationCleanupScheduler,
  ],
  controllers: [EmailConfirmationController],
  exports: [EmailConfirmationService],
})
export class EmailConfirmationModule {}
