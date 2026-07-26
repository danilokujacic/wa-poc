import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReservationRepository } from '../repository/reservation.repository';

@Injectable()
export class ReservationStatusScheduler {
    private readonly logger = new Logger(ReservationStatusScheduler.name);

    constructor(private readonly reservationRepository: ReservationRepository) { }

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async declineStalePendingReservations(): Promise<void> {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        const declinedCount = await this.reservationRepository.declineStalePending(today);
        this.logger.log(`Auto-declined ${declinedCount} pending reservation(s) with startDate >= today`);
    }
}
