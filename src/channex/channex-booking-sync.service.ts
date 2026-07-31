import { Injectable, Logger } from '@nestjs/common';
import { ResortRepository } from '../repository/resort.repository';
import { ResortFeatureRepository } from '../repository/resort-feature.repository';
import { ReservationRepository } from '../repository/reservation.repository';
import {
  ReservationSource,
  ReservationStatus,
} from '../entity/reservation.entity';
import { ChannexApiClient } from './channex-api.client';
import { ChannexAriProducer } from '../bullmq/channex-ari/channex-ari.producer';
import {
  ChannexBookingRevision,
  ChannexBookingRevisionAttributes,
  ChannexRoomStay,
} from './channex-booking-revision.interface';

@Injectable()
export class ChannexBookingSyncService {
  private readonly logger = new Logger(ChannexBookingSyncService.name);

  constructor(
    private readonly channexApiClient: ChannexApiClient,
    private readonly resortRepository: ResortRepository,
    private readonly resortFeatureRepository: ResortFeatureRepository,
    private readonly reservationRepository: ReservationRepository,
    private readonly channexAriProducer: ChannexAriProducer,
  ) {}

  async applyAndAckRevision(revisionId: string): Promise<void> {
    const revision = await this.channexApiClient.get<ChannexBookingRevision>(
      `/booking_revisions/${revisionId}`,
    );
    await this.applyRevision(revision);
    await this.channexApiClient.post(`/booking_revisions/${revisionId}/ack`);
  }

  async applyRevision(revision: ChannexBookingRevision): Promise<void> {
    const attrs = revision.attributes;

    const resort = await this.resortRepository.findOne({
      where: { channexPropertyId: attrs.property_id },
    });
    if (!resort) {
      this.logger.warn(
        `Skipping Channex booking ${attrs.booking_id}: property ${attrs.property_id} is not mapped to a resort`,
      );
      return;
    }

    if (attrs.status === 'cancelled') {
      const affectedFeatureIds =
        await this.reservationRepository.cancelByChannexBookingId(
          attrs.booking_id,
        );
      for (const featureId of affectedFeatureIds) {
        void this.channexAriProducer.enqueueAvailabilityPush(featureId);
      }
      this.logger.log(
        `Cancelled reservation(s) for Channex booking ${attrs.booking_id} across ${affectedFeatureIds.length} feature(s)`,
      );
      return;
    }

    if (attrs.status === 'modified') {
      // Blindly applying an OTA-side date/room/price change to a live calendar
      // needs reconciliation UX this PMS doesn't have yet — surface it instead.
      this.logger.warn(
        `Channex booking ${attrs.booking_id} (${attrs.ota_name ?? 'unknown OTA'}) was modified upstream — needs manual review, not auto-applied`,
      );
      return;
    }

    const rooms = attrs.rooms ?? [];
    if (rooms.length === 0) {
      this.logger.warn(
        `Channex booking ${attrs.booking_id} has no room segments — nothing to create`,
      );
      return;
    }

    for (const room of rooms) {
      await this.applyRoomSegment(resort.id, attrs, room);
    }
  }

  private async applyRoomSegment(
    resortId: string,
    attrs: ChannexBookingRevisionAttributes,
    room: ChannexRoomStay,
  ): Promise<void> {
    if (!room.room_type_id) {
      this.logger.warn(
        `Channex booking ${attrs.booking_id} has a room segment with no room_type_id — skipping`,
      );
      return;
    }

    const feature = await this.resortFeatureRepository.findOne({
      where: { channexRoomTypeId: room.room_type_id, resort: { id: resortId } },
    });
    if (!feature) {
      this.logger.warn(
        `Skipping Channex booking ${attrs.booking_id} room segment: room type ${room.room_type_id} is not mapped to a feature`,
      );
      return;
    }

    const checkin = room.checkin_date ?? attrs.arrival_date;
    const checkout = room.checkout_date ?? attrs.departure_date;
    if (!checkin || !checkout) {
      this.logger.warn(
        `Channex booking ${attrs.booking_id} room segment is missing dates — skipping`,
      );
      return;
    }

    const startDate = new Date(checkin);
    const endDate = new Date(checkout);

    // Revisions can resend (webhook retry + feed backstop both firing, or a
    // replayed feed poll) — dedupe on the booking/feature/date combo rather
    // than relying on a DB-level unique constraint, since one Channex booking
    // legitimately produces multiple reservation rows for a multi-room stay.
    const existing = await this.reservationRepository.findOne({
      where: {
        channexBookingId: attrs.booking_id,
        feature: { id: feature.id },
        startDate,
        endDate,
      },
    });
    if (existing) {
      return;
    }

    const occupancy = room.occupancy ?? {};
    const customer = attrs.customer;
    const guestName = customer
      ? [customer.name, customer.surname].filter(Boolean).join(' ')
      : undefined;

    const reservation = this.reservationRepository.create({
      feature,
      // An OTA booking is already a confirmed sale on the channel side — there
      // is no "pending approval" step the way there is for a WhatsApp inquiry.
      status: ReservationStatus.ACCEPTED,
      startDate,
      endDate,
      phoneNumber: customer?.phone ?? '',
      adults: occupancy.adults ?? 1,
      kids: occupancy.children ?? 0,
      otherContact: customer
        ? { name: guestName || undefined, email: customer.mail }
        : null,
      source: ReservationSource.CHANNEX,
      channexBookingId: attrs.booking_id,
      otaName: attrs.ota_name ?? null,
      otaReservationCode: attrs.ota_reservation_code ?? null,
    });

    await this.reservationRepository.save(reservation);
    void this.channexAriProducer.enqueueAvailabilityPush(feature.id);

    // Never drop an OTA booking over a capacity mismatch — the guest already
    // has a real confirmation on the channel side whether or not the room
    // math likes it. Just make sure someone finds out fast: log loud (an
    // error, not a warning) rather than persist a flag that could drift from
    // reality — see Reservation.isOverbooked for how this gets surfaced on read.
    const overlapping = await this.reservationRepository.findActiveOverlapping(
      feature.id,
      startDate,
      endDate,
    );
    if (overlapping.length > feature.quantity) {
      this.logger.error(
        `OVERBOOKED: Channex booking ${attrs.booking_id} (${attrs.ota_name ?? 'unknown OTA'}) for feature "${feature.name}" (${feature.id}) — ` +
          `${overlapping.length}/${feature.quantity} reservations now occupy ${checkin} to ${checkout}`,
      );
    }

    this.logger.log(
      `Created reservation ${reservation.id} from Channex booking ${attrs.booking_id} (${attrs.ota_name ?? 'unknown OTA'})`,
    );
  }
}
