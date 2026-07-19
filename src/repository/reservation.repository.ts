import { Injectable } from '@nestjs/common';
import { DataSource, In, Repository } from 'typeorm';
import { ACTIVE_RESERVATION_STATUSES, Reservation, ReservationStatus } from '../entity/reservation.entity';

@Injectable()
export class ReservationRepository extends Repository<Reservation> {
    constructor(private readonly dataSource: DataSource) {
        super(Reservation, dataSource.createEntityManager());
    }

    countActiveForFeature(featureId: string): Promise<number> {
        return this.count({
            where: { feature: { id: featureId }, status: In(ACTIVE_RESERVATION_STATUSES) },
        });
    }

    findLatestPendingForGuest(featureResortId: string, phoneNumber: string): Promise<Reservation | null> {
        return this.findOne({
            where: {
                phoneNumber,
                status: ReservationStatus.PENDING,
                feature: { resort: { id: featureResortId } },
            },
            relations: { feature: true },
            order: { createdAt: 'DESC' },
        });
    }
}
