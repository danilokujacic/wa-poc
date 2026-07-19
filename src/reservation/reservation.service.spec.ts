import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ReservationService } from './reservation.service';
import { ReservationRepository } from '../repository/reservation.repository';
import { ResortFeatureRepository } from '../repository/resort-feature.repository';
import { ReservationStatus } from '../entity/reservation.entity';

describe('ReservationService', () => {
    let service: ReservationService;
    let reservationRepository: {
        create: jest.Mock; save: jest.Mock; find: jest.Mock; findOne: jest.Mock; remove: jest.Mock; countActiveForFeature: jest.Mock;
    };
    let resortFeatureRepository: { findOne: jest.Mock };

    beforeEach(async () => {
        reservationRepository = {
            create: jest.fn((dto) => dto),
            save: jest.fn(async (entity) => entity),
            find: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
            countActiveForFeature: jest.fn(),
        };
        resortFeatureRepository = {
            findOne: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ReservationService,
                { provide: ReservationRepository, useValue: reservationRepository },
                { provide: ResortFeatureRepository, useValue: resortFeatureRepository },
            ],
        }).compile();

        service = module.get<ReservationService>(ReservationService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('creates a reservation for a feature belonging to the resort', async () => {
        resortFeatureRepository.findOne.mockResolvedValue({ id: 'feature-1', quantity: 5 });
        const dto = { featureId: 'feature-1', startDate: '2026-08-01', endDate: '2026-08-03', phoneNumber: '123' };

        const result = await service.create('resort-1', dto);

        expect(resortFeatureRepository.findOne).toHaveBeenCalledWith({
            where: { id: 'feature-1', resort: { id: 'resort-1' } },
        });
        expect(reservationRepository.create).toHaveBeenCalledWith({
            startDate: '2026-08-01',
            endDate: '2026-08-03',
            phoneNumber: '123',
            feature: { id: 'feature-1', quantity: 5 },
        });
        expect(result).toBeDefined();
    });

    it('rejects creation when the feature does not belong to this resort', async () => {
        resortFeatureRepository.findOne.mockResolvedValue(null);

        await expect(
            service.create('resort-1', { featureId: 'other-resort-feature', startDate: '2026-08-01', endDate: '2026-08-03', phoneNumber: '123' }),
        ).rejects.toThrow(NotFoundException);
        expect(reservationRepository.create).not.toHaveBeenCalled();
    });

    it('lists reservations scoped to the resort', async () => {
        const reservations = [{ id: '1' }];
        reservationRepository.find.mockResolvedValue(reservations);

        const result = await service.findAll('resort-1');

        expect(reservationRepository.find).toHaveBeenCalledWith({
            where: { feature: { resort: { id: 'resort-1' } } },
            relations: { feature: true },
        });
        expect(result).toBe(reservations);
    });

    it('throws when a reservation does not belong to this resort', async () => {
        reservationRepository.findOne.mockResolvedValue(null);

        await expect(service.findOne('resort-1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('updates a reservation status', async () => {
        const reservation = { id: '1', status: ReservationStatus.PENDING };
        reservationRepository.findOne.mockResolvedValue(reservation);

        const result = await service.update('resort-1', '1', { status: ReservationStatus.ACCEPTED });

        expect(reservationRepository.save).toHaveBeenCalledWith({ ...reservation, status: ReservationStatus.ACCEPTED });
        expect(result.status).toBe(ReservationStatus.ACCEPTED);
    });

    it('rejects moving a reservation to a feature from another resort', async () => {
        reservationRepository.findOne.mockResolvedValue({ id: '1', status: ReservationStatus.PENDING });
        resortFeatureRepository.findOne.mockResolvedValue(null);

        await expect(
            service.update('resort-1', '1', { featureId: 'other-resort-feature' }),
        ).rejects.toThrow(NotFoundException);
    });

    it('removes a reservation', async () => {
        const reservation = { id: '1' };
        reservationRepository.findOne.mockResolvedValue(reservation);

        await service.remove('resort-1', '1');

        expect(reservationRepository.remove).toHaveBeenCalledWith(reservation);
    });

    it('computes availability as quantity minus active reservations', async () => {
        resortFeatureRepository.findOne.mockResolvedValue({ id: 'feature-1', quantity: 5 });
        reservationRepository.countActiveForFeature.mockResolvedValue(2);

        const result = await service.getAvailability('resort-1', 'feature-1');

        expect(reservationRepository.countActiveForFeature).toHaveBeenCalledWith('feature-1');
        expect(result).toBe(3);
    });

    it('never returns negative availability', async () => {
        resortFeatureRepository.findOne.mockResolvedValue({ id: 'feature-1', quantity: 2 });
        reservationRepository.countActiveForFeature.mockResolvedValue(5);

        const result = await service.getAvailability('resort-1', 'feature-1');

        expect(result).toBe(0);
    });
});
