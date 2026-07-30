import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ResortFeatureService } from './resort-feature.service';
import { ResortFeatureRepository } from '../repository/resort-feature.repository';
import { ReservationRepository } from '../repository/reservation.repository';
import { ChannexContentSyncService } from '../channex/channex-content-sync.service';
import { ResortFeature } from '../entity/resort-feature.entity';

describe('ResortFeatureService', () => {
    let service: ResortFeatureService;
    let repository: { save: jest.Mock; find: jest.Mock; findOne: jest.Mock; remove: jest.Mock; manager: { transaction: jest.Mock } };
    let manager: { create: jest.Mock; save: jest.Mock; findOne: jest.Mock };
    let reservationRepository: { declinePendingForFeature: jest.Mock };
    let channexContentSyncService: { syncRoomType: jest.Mock };

    beforeEach(async () => {
        manager = {
            create: jest.fn((_entityClass, dto) => dto),
            save: jest.fn(async (entity) => entity),
            findOne: jest.fn(),
        };
        repository = {
            save: jest.fn(async (entity) => entity),
            find: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
            manager: {
                transaction: jest.fn(async (cb) => cb(manager)),
            },
        };
        reservationRepository = {
            declinePendingForFeature: jest.fn(),
        };
        channexContentSyncService = {
            syncRoomType: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ResortFeatureService,
                { provide: ResortFeatureRepository, useValue: repository },
                { provide: ReservationRepository, useValue: reservationRepository },
                { provide: ChannexContentSyncService, useValue: channexContentSyncService },
            ],
        }).compile();

        service = module.get<ResortFeatureService>(ResortFeatureService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('creates a feature for a resort not connected to Channex', async () => {
        const dto = { name: 'Cabana', price: 49.99, quantity: 5, capacity: 2 };
        manager.findOne.mockResolvedValue({ id: 'resort-1', channexPropertyId: null });

        const result = await service.create('resort-1', dto);

        expect(manager.create).toHaveBeenCalledWith(ResortFeature, {
            name: 'Cabana',
            price: 49.99,
            quantity: 5,
            capacity: 2,
            resort: { id: 'resort-1' },
        });
        expect(manager.save).toHaveBeenCalledTimes(1);
        expect(channexContentSyncService.syncRoomType).not.toHaveBeenCalled();
        expect(result).toEqual({
            name: 'Cabana',
            price: 49.99,
            quantity: 5,
            capacity: 2,
            resort: { id: 'resort-1' },
        });
    });

    it('syncs the feature to Channex and stores the returned room type id when the resort is connected', async () => {
        const dto = { name: 'Cabana', price: 49.99, quantity: 5, capacity: 2 };
        manager.findOne.mockResolvedValue({ id: 'resort-1', channexPropertyId: 'channex-property-1' });
        channexContentSyncService.syncRoomType.mockResolvedValue('channex-room-type-1');

        const result = await service.create('resort-1', dto);

        expect(channexContentSyncService.syncRoomType).toHaveBeenCalledWith(
            { id: 'resort-1', channexPropertyId: 'channex-property-1' },
            expect.objectContaining({ name: 'Cabana' }),
        );
        expect(result.channexRoomTypeId).toBe('channex-room-type-1');
        expect(manager.save).toHaveBeenCalledTimes(2);
    });

    it('rejects without returning a feature when the Channex push fails, so the transaction rolls back', async () => {
        const dto = { name: 'Cabana', price: 49.99, quantity: 5, capacity: 2 };
        manager.findOne.mockResolvedValue({ id: 'resort-1', channexPropertyId: 'channex-property-1' });
        channexContentSyncService.syncRoomType.mockRejectedValue(new Error('Channex is down'));

        await expect(service.create('resort-1', dto)).rejects.toThrow('Channex is down');
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

    it('updates a feature not connected to Channex', async () => {
        const feature = { id: '1', name: 'Cabana', price: 49.99, quantity: 5, resort: { id: 'resort-1', channexPropertyId: null } };
        manager.findOne.mockResolvedValue(feature);

        const result = await service.update('resort-1', '1', { price: 59.99 });

        expect(manager.save).toHaveBeenCalledWith({ ...feature, price: 59.99 });
        expect(channexContentSyncService.syncRoomType).not.toHaveBeenCalled();
        expect(result.price).toBe(59.99);
    });

    it('re-syncs an updated feature to Channex when the resort is connected', async () => {
        const feature = {
            id: '1',
            name: 'Cabana',
            price: 49.99,
            quantity: 5,
            channexRoomTypeId: 'channex-room-type-1',
            resort: { id: 'resort-1', channexPropertyId: 'channex-property-1' },
        };
        manager.findOne.mockResolvedValue(feature);
        channexContentSyncService.syncRoomType.mockResolvedValue('channex-room-type-1');

        const result = await service.update('resort-1', '1', { price: 59.99 });

        expect(channexContentSyncService.syncRoomType).toHaveBeenCalledWith(feature.resort, feature);
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
