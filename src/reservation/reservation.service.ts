import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ReservationRepository } from '../repository/reservation.repository';
import { ResortFeatureRepository } from '../repository/resort-feature.repository';
import {
  ACTIVE_RESERVATION_STATUSES,
  ALLOWED_RESERVATION_STATUS_TRANSITIONS,
  Reservation,
  ReservationSource,
  ReservationStatus,
} from '../entity/reservation.entity';
import { ResortFeature } from '../entity/resort-feature.entity';
import {
  FindOptionsWhere,
  ILike,
  LessThanOrEqual,
  MoreThanOrEqual,
} from 'typeorm';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { FindReservationsQueryDto } from './dto/find-reservations-query.dto';
import { ChannexAriProducer } from '../bullmq/channex-ari/channex-ari.producer';
import { DESK_EVENTS } from '../desk/desk.events';
import type { ReservationStatusMessageEvent } from '../desk/desk.events';

function isOccupying(status: ReservationStatus): boolean {
  return ACTIVE_RESERVATION_STATUSES.includes(status);
}

@Injectable()
export class ReservationService {
  constructor(
    private readonly reservationRepository: ReservationRepository,
    private readonly resortFeatureRepository: ResortFeatureRepository,
    private readonly channexAriProducer: ChannexAriProducer,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(
    resortId: string,
    createReservationDto: CreateReservationDto,
  ): Promise<Reservation> {
    const { featureId, ...rest } = createReservationDto;
    const feature = await this.ensureFeatureBelongsToResort(
      resortId,
      featureId,
    );

    const reservation = this.reservationRepository.create({
      ...rest,
      feature,
    });
    const saved = await this.reservationRepository.save(reservation);
    // Pending doesn't occupy anything — only push if this was created
    // pre-accepted (staff can set `status` directly, e.g. a walk-in).
    if (isOccupying(saved.status)) {
      void this.channexAriProducer.enqueueAvailabilityPush(feature.id);
    }
    return saved;
  }

  private parseDate(date: string): Date {
    return new Date(date);
  }

  async findAll(
    resortId: string,
    {
      from = new Date().toString(),
      to,
      status = 'ALL',
      phoneNumber = '',
      overbooked,
    }: FindReservationsQueryDto = {},
  ): Promise<Reservation[]> {
    const fromISO = this.parseDate(from);
    const toISO = to ? this.parseDate(to) : undefined;
    const query: FindOptionsWhere<Reservation> = {
      feature: { resort: { id: resortId } },
      startDate: MoreThanOrEqual(fromISO),
    };

    if (toISO) {
      query.endDate = LessThanOrEqual(toISO);
    }

    if (status && status !== 'ALL') {
      query.status = status;
    }

    if (phoneNumber) {
      query.phoneNumber = ILike(`%${phoneNumber}%`);
    }

    const reservations = await this.reservationRepository.find({
      where: query,
      relations: { feature: true },
    });
    const withFlags = await Promise.all(
      reservations.map((reservation) => this.attachOverbookedFlag(reservation)),
    );

    // isOverbooked is computed, not a column, so this filter can't be part
    // of the query above — it has to happen after the fact, in memory.
    if (overbooked === 'true') {
      return withFlags.filter((reservation) => reservation.isOverbooked);
    }
    return withFlags;
  }

  async findOne(resortId: string, id: string): Promise<Reservation> {
    const reservation = await this.reservationRepository.findOne({
      where: { id, feature: { resort: { id: resortId } } },
      relations: { feature: true },
    });
    if (!reservation) {
      throw new NotFoundException(
        `Reservation with id ${id} not found for resort ${resortId}`,
      );
    }
    return this.attachOverbookedFlag(reservation);
  }

  // Computed fresh from current state every time, same principle as
  // availability itself — never stored, so it can never drift from reality.
  // A reservation only "occupies" (and can therefore be overbooked) once
  // it's Accepted/Progress; Pending was never holding a unit in the first
  // place.
  private async attachOverbookedFlag(
    reservation: Reservation,
  ): Promise<Reservation> {
    if (!isOccupying(reservation.status)) {
      reservation.isOverbooked = false;
      return reservation;
    }
    const overlapping = await this.reservationRepository.findActiveOverlapping(
      reservation.feature.id,
      reservation.startDate,
      reservation.endDate,
    );
    reservation.isOverbooked =
      overlapping.length > reservation.feature.quantity;
    return reservation;
  }

  async update(
    resortId: string,
    id: string,
    updateReservationDto: UpdateReservationDto,
  ): Promise<Reservation> {
    const reservation = await this.findOne(resortId, id);
    const oldFeatureId = reservation.feature.id;
    const { featureId, ...rest } = updateReservationDto;
    Object.assign(reservation, rest);
    if (featureId) {
      reservation.feature = await this.ensureFeatureBelongsToResort(
        resortId,
        featureId,
      );
    }
    const saved = await this.reservationRepository.save(reservation);

    // A date/feature edit on a still-Pending reservation doesn't change what
    // Channex should show — only push if this reservation actually occupies.
    if (isOccupying(saved.status)) {
      void this.channexAriProducer.enqueueAvailabilityPush(oldFeatureId);
      if (saved.feature.id !== oldFeatureId) {
        void this.channexAriProducer.enqueueAvailabilityPush(saved.feature.id);
      }
    }

    return saved;
  }

  async updateStatus(
    resortId: string,
    id: string,
    status: ReservationStatus,
  ): Promise<Reservation> {
    const reservation = await this.findOne(resortId, id);

    const allowedNextStatuses =
      ALLOWED_RESERVATION_STATUS_TRANSITIONS[reservation.status];
    if (!allowedNextStatuses.includes(status)) {
      throw new BadRequestException(
        `Cannot change reservation status from ${reservation.status} to ${status}`,
      );
    }

    reservation.status = status;
    const saved = await this.reservationRepository.save(reservation);
    void this.channexAriProducer.enqueueAvailabilityPush(saved.feature.id);

    // Staff (not the guest) is the one confirming/declining a WhatsApp
    // reservation via this endpoint — let the guest know either way. OTA
    // reservations aren't reachable through this resort's WhatsApp number in
    // the same sense, so this is scoped to reservations that came in via
    // WhatsApp/manual entry.
    if (
      saved.source === ReservationSource.MANUAL &&
      (status === ReservationStatus.ACCEPTED ||
        status === ReservationStatus.DECLINED)
    ) {
      const body =
        status === ReservationStatus.ACCEPTED
          ? `Your reservation for ${saved.feature.name} has been confirmed!`
          : `Your reservation for ${saved.feature.name} has been declined.`;
      const event: ReservationStatusMessageEvent = {
        resortId,
        guestPhoneNumber: saved.phoneNumber,
        body,
        sentAt: new Date().toISOString(),
        traceId: saved.id,
      };
      this.eventEmitter.emit(DESK_EVENTS.RESERVATION_STATUS_MESSAGE, event);
    }

    return saved;
  }

  async remove(resortId: string, id: string): Promise<void> {
    const reservation = await this.findOne(resortId, id);
    const featureId = reservation.feature.id;
    const wasOccupying = isOccupying(reservation.status);
    await this.reservationRepository.remove(reservation);
    if (wasOccupying) {
      void this.channexAriProducer.enqueueAvailabilityPush(featureId);
    }
  }

  async getAvailability(resortId: string, featureId: string): Promise<number> {
    const feature = await this.ensureFeatureBelongsToResort(
      resortId,
      featureId,
    );
    const activeCount =
      await this.reservationRepository.countActiveForFeature(featureId);
    return Math.max(feature.quantity - activeCount, 0);
  }

  async getAvailabilityForAllFeatures(
    resortId: string,
  ): Promise<Array<{ featureId: string; name: string; availability: number }>> {
    const features = await this.resortFeatureRepository.find({
      where: { resort: { id: resortId }, isActive: true },
    });
    if (features.length === 0) {
      return [];
    }

    const activeCounts =
      await this.reservationRepository.countActiveForFeatures(
        features.map((feature) => feature.id),
      );

    return features.map((feature) => ({
      featureId: feature.id,
      name: feature.name,
      availability: Math.max(
        feature.quantity - (activeCounts.get(feature.id) ?? 0),
        0,
      ),
    }));
  }

  private async ensureFeatureBelongsToResort(
    resortId: string,
    featureId: string,
  ): Promise<ResortFeature> {
    const feature = await this.resortFeatureRepository.findOne({
      where: { id: featureId, resort: { id: resortId } },
    });
    if (!feature) {
      throw new NotFoundException(
        `Feature with id ${featureId} not found for resort ${resortId}`,
      );
    }
    if (!feature.isActive) {
      throw new BadRequestException(
        `Feature with id ${featureId} has been deleted and can no longer be used for reservations`,
      );
    }
    return feature;
  }
}
