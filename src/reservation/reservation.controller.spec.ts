import { Test, TestingModule } from '@nestjs/testing';
import { ReservationController } from './reservation.controller';
import { ReservationService } from './reservation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ResortMemberGuard } from '../resort/guards/resort-member.guard';
import { ReservationStatus } from '../entity/reservation.entity';

describe('ReservationController', () => {
  let controller: ReservationController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    updateStatus: jest.Mock;
    remove: jest.Mock;
    getAvailability: jest.Mock;
    getAvailabilityForAllFeatures: jest.Mock;
  };

  const feature = {
    id: 'feature-1',
    name: 'Cabana',
    description: null,
    price: 49.99,
    quantity: 5,
    capacity: 2,
    images: null,
  };
  const reservation = {
    id: 'reservation-1',
    status: ReservationStatus.PENDING,
    startDate: new Date('2026-08-01'),
    endDate: new Date('2026-08-03'),
    phoneNumber: '123',
    adults: 2,
    kids: 0,
    otherContact: null,
    createdAt: new Date('2026-07-01'),
    feature,
  };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      updateStatus: jest.fn(),
      remove: jest.fn(),
      getAvailability: jest.fn(),
      getAvailabilityForAllFeatures: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReservationController],
      providers: [{ provide: ReservationService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ResortMemberGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ReservationController>(ReservationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates create to the service', async () => {
    const dto = {
      featureId: 'feature-1',
      startDate: '2026-08-01',
      endDate: '2026-08-03',
      phoneNumber: '123',
      adults: 2,
      kids: 0,
    };
    service.create.mockResolvedValue(reservation);

    await controller.create('resort-1', dto);

    expect(service.create).toHaveBeenCalledWith('resort-1', dto);
  });

  it('delegates findAll to the service', async () => {
    service.findAll.mockResolvedValue([reservation]);

    await controller.findAll('resort-1', {});

    expect(service.findAll).toHaveBeenCalledWith('resort-1', {});
  });

  it('delegates getAvailabilityForAllFeatures to the service', async () => {
    service.getAvailabilityForAllFeatures.mockResolvedValue([
      { featureId: 'feature-1', name: 'Cabana', availability: 3 },
    ]);

    await controller.getAvailabilityForAllFeatures('resort-1');

    expect(service.getAvailabilityForAllFeatures).toHaveBeenCalledWith(
      'resort-1',
    );
  });

  it('delegates getAvailability to the service', async () => {
    service.getAvailability.mockResolvedValue(3);

    const result = await controller.getAvailability('resort-1', 'feature-1');

    expect(service.getAvailability).toHaveBeenCalledWith(
      'resort-1',
      'feature-1',
    );
    expect(result).toBe(3);
  });

  it('delegates findOne to the service', async () => {
    service.findOne.mockResolvedValue(reservation);

    await controller.findOne('resort-1', 'reservation-1');

    expect(service.findOne).toHaveBeenCalledWith('resort-1', 'reservation-1');
  });

  it('delegates update to the service', async () => {
    const dto = { adults: 3 };
    service.update.mockResolvedValue(reservation);

    await controller.update('resort-1', 'reservation-1', dto);

    expect(service.update).toHaveBeenCalledWith(
      'resort-1',
      'reservation-1',
      dto,
    );
  });

  it('delegates updateStatus to the service', async () => {
    const dto = { status: ReservationStatus.ACCEPTED };
    service.updateStatus.mockResolvedValue({
      ...reservation,
      status: ReservationStatus.ACCEPTED,
    });

    await controller.updateStatus('resort-1', 'reservation-1', dto);

    expect(service.updateStatus).toHaveBeenCalledWith(
      'resort-1',
      'reservation-1',
      ReservationStatus.ACCEPTED,
    );
  });

  it('delegates remove to the service', async () => {
    await controller.remove('resort-1', 'reservation-1');
    expect(service.remove).toHaveBeenCalledWith('resort-1', 'reservation-1');
  });
});
