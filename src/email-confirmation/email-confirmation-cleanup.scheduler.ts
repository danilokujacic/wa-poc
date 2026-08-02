import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EmailConfirmationRepository } from '../repository/email-confirmation.repository';

@Injectable()
export class EmailConfirmationCleanupScheduler {
  private readonly logger = new Logger(EmailConfirmationCleanupScheduler.name);

  constructor(
    private readonly emailConfirmationRepository: EmailConfirmationRepository,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async deleteExpiredConfirmations(): Promise<void> {
    const deletedCount = await this.emailConfirmationRepository.deleteExpired();
    this.logger.log(`Deleted ${deletedCount} expired email confirmation(s)`);
  }
}
