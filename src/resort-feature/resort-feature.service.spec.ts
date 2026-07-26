import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ResortFeatureService } from './resort-feature.service';
import { ResortFeatureRepository } from '../repository/resort-feature.repository';
import { ReservationRepository } from '../repository/reservation.repository';

describe('ResortFeatureService', () => {
    let service: ResortFeatureService;
    let repository: { create: jest.Mock; save: jest.Mock; find: jest.Mock; findOne: jest.Mock; remove: jest.Mock };
    let reservationRepository: { declinePendingForFeature: jest.Mock };

    beforeEach(async () => {
        repository = {
            create: jest.fn((dto) => dto),
            save: jest.fn(async (entity) => entity),
            find: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
        };
        reservationRepository = {
            declinePendingForFeature: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ResortFeatureService,
                { provide: ResortFeatureRepository, useValue: repository },
                { provide: ReservationRepository, useValue: reservationRepository },
            ],
        }).compile();

        service = module.get<ResortFeatureService>(ResortFeatureService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('creates a feature for a resort', async () => {
        const dto = { name: 'Cabana', price: 49.99, quantity: 5, capacity: 2 };

        const result = await service.create('resort-1', dto);

        expect(repository.create).toHaveBeenCalledWith({
            name: 'Cabana',
            price: 49.99,
            quantity: 5,
            capacity: 2,
            resort: { id: 'resort-1' },
        });
        expect(repository.save).toHaveBeenCalled();
        expect(result).toEqual({
            name: 'Cabana',
            price: 49.99,
            quantity: 5,
            capacity: 2,
            resort: { id: 'resort-1' },
        });
    });

    it('returns all features for a resort', async () => {
        const features = [{ id: '1', name: 'Cabana', price: 49.99, quantity: 5 }];
        repository.find.mockResolvedValue(features);

        const result = await service.findAll('resort-1');

        expect(repository.find).toHaveBeenCalledWith({ where: { resort: { id: 'resort-1' }, isActive: true } });
        expect(result).toBe(features);
    });

    it('returns a feature by id scoped to its resort', async () => {
        const feature = { id: '1', name: 'Cabana', price: 49.99, quantity: 5 };
        repository.findOne.mockResolvedValue(feature);

        const result = await service.findOne('resort-1', '1');

        expect(repository.findOne).toHaveBeenCalledWith({ where: { id: '1', resort: { id: 'resort-1' } } });
        expect(result).toBe(feature);
    });

    it('throws when a feature is not found for that resort', async () => {
        repository.findOne.mockResolvedValue(null);

        await expect(service.findOne('resort-1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('updates a feature', async () => {
        const feature = { id: '1', name: 'Cabana', price: 49.99, quantity: 5 };
        repository.findOne.mockResolvedValue(feature);

        const result = await service.update('resort-1', '1', { price: 59.99 });

        expect(repository.save).toHaveBeenCalledWith({ ...feature, price: 59.99 });
        expect(result.price).toBe(59.99);
    });

    it('soft-deletes a feature by marking it inactive, rather than removing the row', async () => {
        const feature = { id: '1', name: 'Cabana', price: 49.99, quantity: 5, isActive: true };
        repository.findOne.mockResolvedValue(feature);

        await service.remove('resort-1', '1');

        expect(repository.save).toHaveBeenCalledWith({ ...feature, isActive: false });
        expect(repository.remove).not.toHaveBeenCalled();
    });

    it('declines pending reservations for the feature being removed', async () => {
        const feature = { id: '1', name: 'Cabana', price: 49.99, quantity: 5, isActive: true };
        repository.findOne.mockResolvedValue(feature);

        await service.remove('resort-1', '1');

        expect(reservationRepository.declinePendingForFeature).toHaveBeenCalledWith('1');
    });
});
