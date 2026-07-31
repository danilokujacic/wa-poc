import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReservationRepository } from '../repository/reservation.repository';

@Injectable()
export class ReservationStatusScheduler {
  private readonly logger = new Logger(ReservationStatusScheduler.name);

  constructor(private readonly reservationRepository: ReservationRepository) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async declineStalePendingReservations(): Promise<void> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Only ever touches Pending reservations, which don't occupy a unit —
    // nothing here changes what should be reported to Channex.
    const affectedFeatureIds =
      await this.reservationRepository.declineStalePending(today);
    this.logger.log(
      `Auto-declined stale pending reservation(s) across ${affectedFeatureIds.length} feature(s)`,
    );
  }
}
