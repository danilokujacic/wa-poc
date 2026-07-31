import { Injectable } from '@nestjs/common';
import { DataSource, In, LessThan, MoreThan, Repository } from 'typeorm';
import {
  ACTIVE_RESERVATION_STATUSES,
  Reservation,
  ReservationStatus,
} from '../entity/reservation.entity';

@Injectable()
export class ReservationRepository extends Repository<Reservation> {
  constructor(private readonly dataSource: DataSource) {
    super(Reservation, dataSource.createEntityManager());
  }

  countActiveForFeature(featureId: string): Promise<number> {
    return this.count({
      where: {
        feature: { id: featureId },
        status: In(ACTIVE_RESERVATION_STATUSES),
      },
    });
  }

  async countActiveForFeatures(
    featureIds: string[],
  ): Promise<Map<string, number>> {
    if (featureIds.length === 0) {
      return new Map();
    }

    const rows = await this.createQueryBuilder('reservation')
      .innerJoin('reservation.feature', 'feature')
      .select('feature.id', 'featureId')
      .addSelect('COUNT(reservation.id)', 'count')
      .where('feature.id IN (:...featureIds)', { featureIds })
      .andWhere('reservation.status IN (:...statuses)', {
        statuses: ACTIVE_RESERVATION_STATUSES,
      })
      .groupBy('feature.id')
      .getRawMany<{ featureId: string; count: string }>();

    return new Map(rows.map((row) => [row.featureId, Number(row.count)]));
  }

  // Active reservations for a feature overlapping [from, to). endDate is the
  // checkout day (exclusive — the night before is the last occupied night),
  // so the overlap test is startDate < to && endDate > from.
  findActiveOverlapping(
    featureId: string,
    from: Date,
    to: Date,
  ): Promise<Reservation[]> {
    return this.find({
      where: {
        feature: { id: featureId },
        status: In(ACTIVE_RESERVATION_STATUSES),
        startDate: LessThan(to),
        endDate: MoreThan(from),
      },
    });
  }

  findLatestPendingForGuest(
    featureResortId: string,
    phoneNumber: string,
  ): Promise<Reservation | null> {
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

  // Returns the distinct feature ids affected, so callers can push updated
  // availability to Channex for exactly the features that changed — this
  // uses createQueryBuilder + RETURNING instead of Repository.update()
  // (which only reports an affected count, not which rows changed).
  async declineStalePending(cutoff: Date): Promise<string[]> {
    const result = await this.createQueryBuilder()
      .update(Reservation)
      .set({ status: ReservationStatus.DECLINED })
      .where('status = :status', { status: ReservationStatus.PENDING })
      .andWhere('"startDate" >= :cutoff', { cutoff })
      .returning('"featureId"')
      .execute();
    const rows = result.raw as Array<{ featureId: string }>;
    return [...new Set(rows.map((row) => row.featureId))];
  }

  async declinePendingForFeature(featureId: string): Promise<number> {
    const result = await this.update(
      { feature: { id: featureId }, status: ReservationStatus.PENDING },
      { status: ReservationStatus.DECLINED },
    );
    return result.affected ?? 0;
  }

  // A Channex cancellation is authoritative regardless of the reservation's
  // current status, so this bypasses ALLOWED_RESERVATION_STATUS_TRANSITIONS
  // (e.g. an already-ACCEPTED booking can still be cancelled OTA-side).
  // Finished stays are left alone — the guest already stayed.
  async cancelByChannexBookingId(channexBookingId: string): Promise<string[]> {
    const result = await this.createQueryBuilder()
      .update(Reservation)
      .set({ status: ReservationStatus.DECLINED })
      .where('"channexBookingId" = :channexBookingId', { channexBookingId })
      .andWhere('status != :finished', { finished: ReservationStatus.FINISHED })
      .returning('"featureId"')
      .execute();
    const rows = result.raw as Array<{ featureId: string }>;
    return [...new Set(rows.map((row) => row.featureId))];
  }
}
