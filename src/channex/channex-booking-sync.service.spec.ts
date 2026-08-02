import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ChannexBookingSyncService } from './channex-booking-sync.service';
import { ChannexApiClient } from './channex-api.client';
import { ResortRepository } from '../repository/resort.repository';
import { ResortFeatureRepository } from '../repository/resort-feature.repository';
import { ReservationRepository } from '../repository/reservation.repository';
import { ChannexAriProducer } from '../bullmq/channex-ari/channex-ari.producer';
import {
  ReservationSource,
  ReservationStatus,
} from '../entity/reservation.entity';
import { ChannexBookingRevision } from './channex-booking-revision.interface';

describe('ChannexBookingSyncService', () => {
  let service: ChannexBookingSyncService;
  let channexApiClient: { get: jest.Mock; post: jest.Mock };
  let resortRepository: { findOne: jest.Mock };
  let resortFeatureRepository: { findOne: jest.Mock };
  let reservationRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    findActiveOverlapping: jest.Mock;
    cancelByChannexBookingId: jest.Mock;
  };
  let channexAriProducer: { enqueueAvailabilityPush: jest.Mock };

  const resort = { id: 'resort-1', channexPropertyId: 'property-1' };
  const feature = {
    id: 'feature-1',
    name: 'Cabana',
    quantity: 5,
    channexRoomTypeId: 'room-type-1',
  };

  function revision(
    overrides: Partial<ChannexBookingRevision['attributes']> = {},
  ): ChannexBookingRevision {
    return {
      id: 'revision-1',
      attributes: {
        booking_id: 'booking-1',
        status: 'new',
        property_id: 'property-1',
        ota_name: 'booking.com',
        rooms: [
          {
            room_type_id: 'room-type-1',
            checkin_date: '2026-08-10',
            checkout_date: '2026-08-12',
            occupancy: { adults: 2, children: 1 },
          },
        ],
        customer: {
          name: 'Jane',
          surname: 'Doe',
          mail: 'jane@example.com',
          phone: '555-1234',
        },
        ...overrides,
      },
    };
  }

  beforeEach(async () => {
    channexApiClient = {
      get: jest.fn(),
      post: jest.fn().mockResolvedValue(undefined),
    };
    resortRepository = { findOne: jest.fn().mockResolvedValue(resort) };
    resortFeatureRepository = {
      findOne: jest.fn().mockResolvedValue(feature),
    };
    reservationRepository = {
      create: jest.fn((dto: Record<string, unknown>) => dto),
      save: jest.fn((entity: Record<string, unknown>) =>
        Promise.resolve({ id: 'reservation-1', ...entity }),
      ),
      findOne: jest.fn().mockResolvedValue(null),
      findActiveOverlapping: jest.fn().mockResolvedValue([]),
      cancelByChannexBookingId: jest.fn().mockResolvedValue([]),
    };
    channexAriProducer = { enqueueAvailabilityPush: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannexBookingSyncService,
        { provide: ChannexApiClient, useValue: channexApiClient },
        { provide: ResortRepository, useValue: resortRepository },
        { provide: ResortFeatureRepository, useValue: resortFeatureRepository },
        { provide: ReservationRepository, useValue: reservationRepository },
        { provide: ChannexAriProducer, useValue: channexAriProducer },
      ],
    }).compile();

    service = module.get<ChannexBookingSyncService>(ChannexBookingSyncService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('applyAndAckRevision', () => {
    it('fetches the revision, applies it, then acks it', async () => {
      channexApiClient.get.mockResolvedValue(revision());

      await service.applyAndAckRevision('revision-1');

      expect(channexApiClient.get).toHaveBeenCalledWith(
        '/booking_revisions/revision-1',
      );
      expect(reservationRepository.save).toHaveBeenCalled();
      expect(channexApiClient.post).toHaveBeenCalledWith(
        '/booking_revisions/revision-1/ack',
      );
    });
  });

  describe('applyRevision', () => {
    it('skips when the property is not mapped to a resort', async () => {
      resortRepository.findOne.mockResolvedValue(null);
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      await service.applyRevision(revision());

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('is not mapped to a resort'),
      );
      expect(reservationRepository.create).not.toHaveBeenCalled();
    });

    it('cancels reservations and pushes availability for each affected feature on a cancelled revision', async () => {
      reservationRepository.cancelByChannexBookingId.mockResolvedValue([
        'feature-1',
        'feature-2',
      ]);

      await service.applyRevision(revision({ status: 'cancelled' }));

      expect(
        reservationRepository.cancelByChannexBookingId,
      ).toHaveBeenCalledWith('booking-1');
      expect(channexAriProducer.enqueueAvailabilityPush).toHaveBeenCalledWith(
        'feature-1',
      );
      expect(channexAriProducer.enqueueAvailabilityPush).toHaveBeenCalledWith(
        'feature-2',
      );
      expect(reservationRepository.create).not.toHaveBeenCalled();
    });

    it('logs a warning and does nothing on a modified revision', async () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      await service.applyRevision(revision({ status: 'modified' }));

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('needs manual review'),
      );
      expect(reservationRepository.create).not.toHaveBeenCalled();
      expect(
        reservationRepository.cancelByChannexBookingId,
      ).not.toHaveBeenCalled();
    });

    it('logs a warning and does nothing when a new booking has no room segments', async () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      await service.applyRevision(revision({ rooms: [] }));

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('nothing to create'),
      );
      expect(reservationRepository.create).not.toHaveBeenCalled();
    });

    it('creates a reservation from a new booking revision', async () => {
      await service.applyRevision(revision());

      expect(reservationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          feature,
          status: ReservationStatus.ACCEPTED,
          phoneNumber: '555-1234',
          adults: 2,
          kids: 1,
          otherContact: { name: 'Jane Doe', email: 'jane@example.com' },
          source: ReservationSource.CHANNEX,
          channexBookingId: 'booking-1',
          otaName: 'booking.com',
        }),
      );
      expect(reservationRepository.save).toHaveBeenCalled();
      expect(channexAriProducer.enqueueAvailabilityPush).toHaveBeenCalledWith(
        'feature-1',
      );
    });

    it('produces real Date instances for startDate/endDate, not raw strings', async () => {
      await service.applyRevision(revision());

      const [created] = reservationRepository.create.mock.calls[0] as [
        { startDate: Date; endDate: Date },
      ];
      expect(created.startDate).toBeInstanceOf(Date);
      expect(created.endDate).toBeInstanceOf(Date);
      expect(created.startDate.toISOString().slice(0, 10)).toBe('2026-08-10');
      expect(created.endDate.toISOString().slice(0, 10)).toBe('2026-08-12');
    });

    it('warns and skips a room segment with no room_type_id', async () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      await service.applyRevision(
        revision({
          rooms: [
            {
              checkin_date: '2026-08-10',
              checkout_date: '2026-08-12',
            },
          ],
        }),
      );

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('no room_type_id'),
      );
      expect(reservationRepository.create).not.toHaveBeenCalled();
    });

    it('warns and skips a room segment whose room type is not mapped to a feature', async () => {
      resortFeatureRepository.findOne.mockResolvedValue(null);
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      await service.applyRevision(revision());

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('is not mapped to a feature'),
      );
      expect(reservationRepository.create).not.toHaveBeenCalled();
    });

    it('warns and skips a room segment missing both room and booking-level dates', async () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      await service.applyRevision(
        revision({
          rooms: [{ room_type_id: 'room-type-1' }],
        }),
      );

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('missing dates'),
      );
      expect(reservationRepository.create).not.toHaveBeenCalled();
    });

    it('falls back to booking-level arrival/departure dates when the room segment omits them', async () => {
      await service.applyRevision(
        revision({
          arrival_date: '2026-09-01',
          departure_date: '2026-09-05',
          rooms: [{ room_type_id: 'room-type-1' }],
        }),
      );

      const [created] = reservationRepository.create.mock.calls[0] as [
        { startDate: Date; endDate: Date },
      ];
      expect(created.startDate.toISOString().slice(0, 10)).toBe('2026-09-01');
      expect(created.endDate.toISOString().slice(0, 10)).toBe('2026-09-05');
    });

    it('dedupes when an identical reservation already exists for this booking/feature/dates', async () => {
      reservationRepository.findOne.mockResolvedValue({ id: 'existing' });

      await service.applyRevision(revision());

      expect(reservationRepository.create).not.toHaveBeenCalled();
      expect(reservationRepository.save).not.toHaveBeenCalled();
      expect(channexAriProducer.enqueueAvailabilityPush).not.toHaveBeenCalled();
    });

    it('logs an OVERBOOKED error when active overlapping reservations exceed feature capacity', async () => {
      const errorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();
      reservationRepository.findActiveOverlapping.mockResolvedValue([
        { id: 'r1' },
        { id: 'r2' },
        { id: 'r3' },
        { id: 'r4' },
        { id: 'r5' },
        { id: 'r6' },
      ]);

      await service.applyRevision(revision());

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('OVERBOOKED'),
      );
    });

    it('does not log OVERBOOKED when overlapping reservations are within feature capacity', async () => {
      const errorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();
      reservationRepository.findActiveOverlapping.mockResolvedValue([
        { id: 'r1' },
      ]);

      await service.applyRevision(revision());

      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('creates a reservation for every room segment in a multi-room booking', async () => {
      resortFeatureRepository.findOne
        .mockResolvedValueOnce(feature)
        .mockResolvedValueOnce({ ...feature, id: 'feature-2' });

      await service.applyRevision(
        revision({
          rooms: [
            {
              room_type_id: 'room-type-1',
              checkin_date: '2026-08-10',
              checkout_date: '2026-08-12',
            },
            {
              room_type_id: 'room-type-2',
              checkin_date: '2026-08-10',
              checkout_date: '2026-08-12',
            },
          ],
        }),
      );

      expect(reservationRepository.create).toHaveBeenCalledTimes(2);
      expect(reservationRepository.save).toHaveBeenCalledTimes(2);
    });
  });
});
