import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ReservationService } from './reservation.service';
import { ReservationRepository } from '../repository/reservation.repository';
import { ResortFeatureRepository } from '../repository/resort-feature.repository';
import {
  ReservationSource,
  ReservationStatus,
} from '../entity/reservation.entity';
import { ChannexAriProducer } from '../bullmq/channex-ari/channex-ari.producer';
import { DESK_EVENTS } from '../desk/desk.events';

describe('ReservationService', () => {
  let service: ReservationService;
  let reservationRepository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
    countActiveForFeature: jest.Mock;
    findActiveOverlapping: jest.Mock;
  };
  let resortFeatureRepository: { findOne: jest.Mock };
  let channexAriProducer: {
    enqueueAvailabilityPush: jest.Mock;
    enqueueRestrictionsPush: jest.Mock;
  };
  let eventEmitter: { emit: jest.Mock };

  beforeEach(async () => {
    reservationRepository = {
      create: jest.fn((dto) => dto),
      save: jest.fn(async (entity) => entity),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
      countActiveForFeature: jest.fn(),
      findActiveOverlapping: jest.fn().mockResolvedValue([]),
    };
    resortFeatureRepository = {
      findOne: jest.fn(),
    };
    channexAriProducer = {
      enqueueAvailabilityPush: jest.fn(),
      enqueueRestrictionsPush: jest.fn(),
    };
    eventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationService,
        { provide: ReservationRepository, useValue: reservationRepository },
        { provide: ResortFeatureRepository, useValue: resortFeatureRepository },
        { provide: ChannexAriProducer, useValue: channexAriProducer },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<ReservationService>(ReservationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates a reservation for a feature belonging to the resort', async () => {
    resortFeatureRepository.findOne.mockResolvedValue({
      id: 'feature-1',
      quantity: 5,
      isActive: true,
    });
    const dto = {
      featureId: 'feature-1',
      startDate: '2026-08-01',
      endDate: '2026-08-03',
      phoneNumber: '123',
      adults: 2,
      kids: 0,
    };

    const result = await service.create('resort-1', dto);

    expect(resortFeatureRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'feature-1', resort: { id: 'resort-1' } },
    });
    expect(reservationRepository.create).toHaveBeenCalledWith({
      startDate: '2026-08-01',
      endDate: '2026-08-03',
      phoneNumber: '123',
      adults: 2,
      kids: 0,
      feature: { id: 'feature-1', quantity: 5, isActive: true },
    });
    expect(result).toBeDefined();
    // Defaults to Pending, which doesn't occupy a unit — no push expected.
    expect(channexAriProducer.enqueueAvailabilityPush).not.toHaveBeenCalled();
  });

  it('pushes availability when a reservation is created pre-accepted', async () => {
    resortFeatureRepository.findOne.mockResolvedValue({
      id: 'feature-1',
      quantity: 5,
      isActive: true,
    });
    const dto = {
      featureId: 'feature-1',
      startDate: '2026-08-01',
      endDate: '2026-08-03',
      phoneNumber: '123',
      adults: 2,
      kids: 0,
      status: ReservationStatus.ACCEPTED,
    };

    await service.create('resort-1', dto);

    expect(channexAriProducer.enqueueAvailabilityPush).toHaveBeenCalledWith(
      'feature-1',
    );
  });

  it('rejects creation when the feature does not belong to this resort', async () => {
    resortFeatureRepository.findOne.mockResolvedValue(null);

    await expect(
      service.create('resort-1', {
        featureId: 'other-resort-feature',
        startDate: '2026-08-01',
        endDate: '2026-08-03',
        phoneNumber: '123',
        adults: 2,
        kids: 0,
      }),
    ).rejects.toThrow(NotFoundException);
    expect(reservationRepository.create).not.toHaveBeenCalled();
  });

  it('rejects creation when the feature has been soft-deleted', async () => {
    resortFeatureRepository.findOne.mockResolvedValue({
      id: 'feature-1',
      quantity: 5,
      isActive: false,
    });

    await expect(
      service.create('resort-1', {
        featureId: 'feature-1',
        startDate: '2026-08-01',
        endDate: '2026-08-03',
        phoneNumber: '123',
        adults: 2,
        kids: 0,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(reservationRepository.create).not.toHaveBeenCalled();
  });

  it('lists reservations scoped to the resort', async () => {
    const reservations = [{ id: '1', status: ReservationStatus.PENDING }];
    reservationRepository.find.mockResolvedValue(reservations);

    const result = await service.findAll('resort-1');

    expect(reservationRepository.find).toHaveBeenCalledWith({
      where: { feature: { resort: { id: 'resort-1' } } },
      relations: { feature: true },
    });
    expect(result).toEqual([
      { id: '1', status: ReservationStatus.PENDING, isOverbooked: false },
    ]);
  });

  it('flags an occupying reservation as overbooked when it exceeds feature capacity', async () => {
    const reservation = {
      id: '1',
      status: ReservationStatus.ACCEPTED,
      startDate: '2026-08-01',
      endDate: '2026-08-03',
      feature: { id: 'feature-1', quantity: 1 },
    };
    reservationRepository.find.mockResolvedValue([reservation]);
    // Two occupying reservations (this one plus another) against a
    // 1-unit feature — over capacity.
    reservationRepository.findActiveOverlapping.mockResolvedValue([
      reservation,
      { id: '2' },
    ]);

    const [result] = await service.findAll('resort-1', {});

    expect(reservationRepository.findActiveOverlapping).toHaveBeenCalledWith(
      'feature-1',
      '2026-08-01',
      '2026-08-03',
    );
    expect(result.isOverbooked).toBe(true);
  });

  it('never flags a Pending reservation as overbooked — it never occupied a unit', async () => {
    const reservation = {
      id: '1',
      status: ReservationStatus.PENDING,
      feature: { id: 'feature-1', quantity: 1 },
    };
    reservationRepository.find.mockResolvedValue([reservation]);

    const [result] = await service.findAll('resort-1', {});

    expect(reservationRepository.findActiveOverlapping).not.toHaveBeenCalled();
    expect(result.isOverbooked).toBe(false);
  });

  it('filters to only overbooked reservations when overbooked=true is requested', async () => {
    const overbooked = {
      id: '1',
      status: ReservationStatus.ACCEPTED,
      feature: { id: 'feature-1', quantity: 1 },
    };
    const fine = {
      id: '2',
      status: ReservationStatus.ACCEPTED,
      feature: { id: 'feature-2', quantity: 1 },
    };
    reservationRepository.find.mockResolvedValue([overbooked, fine]);
    reservationRepository.findActiveOverlapping.mockImplementation(
      async (featureId: string) =>
        featureId === 'feature-1' ? [overbooked, { id: '3' }] : [fine],
    );

    const result = await service.findAll('resort-1', { overbooked: 'true' });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('throws when a reservation does not belong to this resort', async () => {
    reservationRepository.findOne.mockResolvedValue(null);

    await expect(service.findOne('resort-1', 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('computes isOverbooked on findOne too', async () => {
    const reservation = {
      id: '1',
      status: ReservationStatus.ACCEPTED,
      startDate: '2026-08-01',
      endDate: '2026-08-03',
      feature: { id: 'feature-1', quantity: 1 },
    };
    reservationRepository.findOne.mockResolvedValue(reservation);
    reservationRepository.findActiveOverlapping.mockResolvedValue([
      reservation,
      { id: '2' },
    ]);

    const result = await service.findOne('resort-1', '1');

    expect(result.isOverbooked).toBe(true);
  });

  it('updates a reservation status', async () => {
    const reservation = {
      id: '1',
      status: ReservationStatus.PENDING,
      feature: { id: 'feature-1' },
    };
    reservationRepository.findOne.mockResolvedValue(reservation);

    const result = await service.update('resort-1', '1', {
      status: ReservationStatus.ACCEPTED,
    });

    expect(reservationRepository.save).toHaveBeenCalledWith({
      ...reservation,
      status: ReservationStatus.ACCEPTED,
    });
    expect(result.status).toBe(ReservationStatus.ACCEPTED);
    expect(channexAriProducer.enqueueAvailabilityPush).toHaveBeenCalledWith(
      'feature-1',
    );
    // update() is not the staff-confirmation endpoint — no guest message here.
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('rejects moving a reservation to a feature from another resort', async () => {
    reservationRepository.findOne.mockResolvedValue({
      id: '1',
      status: ReservationStatus.PENDING,
      feature: { id: 'feature-1' },
    });
    resortFeatureRepository.findOne.mockResolvedValue(null);

    await expect(
      service.update('resort-1', '1', { featureId: 'other-resort-feature' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('does not push when updating a still-pending reservation', async () => {
    const reservation = {
      id: '1',
      status: ReservationStatus.PENDING,
      feature: { id: 'feature-1' },
    };
    reservationRepository.findOne.mockResolvedValue(reservation);

    await service.update('resort-1', '1', { adults: 3 });

    expect(channexAriProducer.enqueueAvailabilityPush).not.toHaveBeenCalled();
  });

  it('notifies the guest by WhatsApp when staff accepts a reservation via updateStatus', async () => {
    const reservation = {
      id: '1',
      status: ReservationStatus.PENDING,
      source: ReservationSource.MANUAL,
      phoneNumber: '123',
      feature: { id: 'feature-1', name: 'Cabana' },
    };
    reservationRepository.findOne.mockResolvedValue(reservation);

    const result = await service.updateStatus(
      'resort-1',
      '1',
      ReservationStatus.ACCEPTED,
    );

    expect(result.status).toBe(ReservationStatus.ACCEPTED);
    expect(channexAriProducer.enqueueAvailabilityPush).toHaveBeenCalledWith(
      'feature-1',
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      DESK_EVENTS.RESERVATION_STATUS_MESSAGE,
      expect.objectContaining({
        resortId: 'resort-1',
        guestPhoneNumber: '123',
        body: expect.stringContaining('confirmed'),
      }),
    );
  });

  it('notifies the guest by WhatsApp when staff declines an already-accepted reservation (e.g. an OTA collision)', async () => {
    const reservation = {
      id: '1',
      status: ReservationStatus.ACCEPTED,
      source: ReservationSource.MANUAL,
      phoneNumber: '123',
      feature: { id: 'feature-1', name: 'Cabana' },
    };
    reservationRepository.findOne.mockResolvedValue(reservation);

    const result = await service.updateStatus(
      'resort-1',
      '1',
      ReservationStatus.DECLINED,
    );

    expect(result.status).toBe(ReservationStatus.DECLINED);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      DESK_EVENTS.RESERVATION_STATUS_MESSAGE,
      expect.objectContaining({ body: expect.stringContaining('declined') }),
    );
  });

  it('does not notify the guest for a Channex-sourced reservation', async () => {
    const reservation = {
      id: '1',
      status: ReservationStatus.PENDING,
      source: ReservationSource.CHANNEX,
      phoneNumber: '123',
      feature: { id: 'feature-1', name: 'Cabana' },
    };
    reservationRepository.findOne.mockResolvedValue(reservation);

    await service.updateStatus('resort-1', '1', ReservationStatus.ACCEPTED);

    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('removes a reservation', async () => {
    const reservation = {
      id: '1',
      status: ReservationStatus.ACCEPTED,
      feature: { id: 'feature-1' },
    };
    reservationRepository.findOne.mockResolvedValue(reservation);

    await service.remove('resort-1', '1');

    expect(reservationRepository.remove).toHaveBeenCalledWith(reservation);
    expect(channexAriProducer.enqueueAvailabilityPush).toHaveBeenCalledWith(
      'feature-1',
    );
  });

  it('does not push when removing a still-pending reservation', async () => {
    const reservation = {
      id: '1',
      status: ReservationStatus.PENDING,
      feature: { id: 'feature-1' },
    };
    reservationRepository.findOne.mockResolvedValue(reservation);

    await service.remove('resort-1', '1');

    expect(channexAriProducer.enqueueAvailabilityPush).not.toHaveBeenCalled();
  });

  it('computes availability as quantity minus active reservations', async () => {
    resortFeatureRepository.findOne.mockResolvedValue({
      id: 'feature-1',
      quantity: 5,
      isActive: true,
    });
    reservationRepository.countActiveForFeature.mockResolvedValue(2);

    const result = await service.getAvailability('resort-1', 'feature-1');

    expect(reservationRepository.countActiveForFeature).toHaveBeenCalledWith(
      'feature-1',
    );
    expect(result).toBe(3);
  });

  it('never returns negative availability', async () => {
    resortFeatureRepository.findOne.mockResolvedValue({
      id: 'feature-1',
      quantity: 2,
      isActive: true,
    });
    reservationRepository.countActiveForFeature.mockResolvedValue(5);

    const result = await service.getAvailability('resort-1', 'feature-1');

    expect(result).toBe(0);
  });
});
