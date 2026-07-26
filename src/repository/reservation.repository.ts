import { Injectable } from '@nestjs/common';
import { DataSource, In, MoreThanOrEqual, Repository } from 'typeorm';
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

    async countActiveForFeatures(featureIds: string[]): Promise<Map<string, number>> {
        if (featureIds.length === 0) {
            return new Map();
        }

        const rows = await this.createQueryBuilder('reservation')
            .innerJoin('reservation.feature', 'feature')
            .select('feature.id', 'featureId')
            .addSelect('COUNT(reservation.id)', 'count')
            .where('feature.id IN (:...featureIds)', { featureIds })
            .andWhere('reservation.status IN (:...statuses)', { statuses: ACTIVE_RESERVATION_STATUSES })
            .groupBy('feature.id')
            .getRawMany<{ featureId: string; count: string }>();

        return new Map(rows.map((row) => [row.featureId, Number(row.count)]));
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

    async declineStalePending(cutoff: Date): Promise<number> {
        const result = await this.update(
            { status: ReservationStatus.PENDING, startDate: MoreThanOrEqual(cutoff) },
            { status: ReservationStatus.DECLINED },
        );
        return result.affected ?? 0;
    }

    async declinePendingForFeature(featureId: string): Promise<number> {
        const result = await this.update(
            { feature: { id: featureId }, status: ReservationStatus.PENDING },
            { status: ReservationStatus.DECLINED },
        );
        return result.affected ?? 0;
    }
}
