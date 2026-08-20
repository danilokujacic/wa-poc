import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RatePeriodService } from './rate-period.service';
import { RatePeriodRepository } from '../repository/rate-period.repository';
import { ResortFeatureRepository } from '../repository/resort-feature.repository';
import { ChannexAriProducer } from '../bullmq/channex-ari/channex-ari.producer';

describe('RatePeriodService', () => {
  let service: RatePeriodService;
  let ratePeriodRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    findAllForFeature: jest.Mock;
    delete: jest.Mock;
  };
  let resortFeatureRepository: { findOne: jest.Mock };
  let channexAriProducer: { enqueueRestrictionsPush: jest.Mock };

  const feature = { id: 'feature-1', resort: { id: 'resort-1' } };

  beforeEach(async () => {
    ratePeriodRepository = {
      create: jest
        .fn()
        .mockImplementation((data: Record<string, unknown>) => data),
      save: jest
        .fn()
        .mockImplementation((data) =>
          Promise.resolve({ id: 'period-1', ...data }),
        ),
      findOne: jest.fn(),
      findAllForFeature: jest.fn().mockResolvedValue([]),
      delete: jest.fn(),
    };
    resortFeatureRepository = { findOne: jest.fn().mockResolvedValue(feature) };
    channexAriProducer = { enqueueRestrictionsPush: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RatePeriodService,
        { provide: RatePeriodRepository, useValue: ratePeriodRepository },
        { provide: ResortFeatureRepository, useValue: resortFeatureRepository },
        { provide: ChannexAriProducer, useValue: channexAriProducer },
      ],
    }).compile();

    service = module.get<RatePeriodService>(RatePeriodService);
  });

  describe('create', () => {
    const dto = {
      name: 'Summer 2026',
      startDate: '2026-06-01',
      endDate: '2026-09-15',
      price: 199,
    };

    it('throws when the feature does not belong to the resort', async () => {
      resortFeatureRepository.findOne.mockResolvedValue(null);
      await expect(
        service.create('resort-1', 'feature-1', dto),
      ).rejects.toThrow(NotFoundException);
      expect(ratePeriodRepository.save).not.toHaveBeenCalled();
    });

    it('rejects a period whose end date is before its start date', async () => {
      await expect(
        service.create('resort-1', 'feature-1', {
          ...dto,
          startDate: '2026-09-15',
          endDate: '2026-06-01',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(ratePeriodRepository.save).not.toHaveBeenCalled();
    });

    it('saves the period and enqueues a Channex restrictions push', async () => {
      await service.create('resort-1', 'feature-1', dto);

      expect(ratePeriodRepository.save).toHaveBeenCalledTimes(1);
      expect(channexAriProducer.enqueueRestrictionsPush).toHaveBeenCalledWith(
        'feature-1',
      );
    });
  });

  describe('findOne', () => {
    it('throws when the period does not exist for that feature', async () => {
      ratePeriodRepository.findOne.mockResolvedValue(null);
      await expect(
        service.findOne('resort-1', 'feature-1', 'missing'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('rejects an update that would make the range invalid', async () => {
      ratePeriodRepository.findOne.mockResolvedValue({
        id: 'period-1',
        startDate: '2026-06-01',
        endDate: '2026-09-15',
      });

      await expect(
        service.update('resort-1', 'feature-1', 'period-1', {
          endDate: '2026-01-01',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(ratePeriodRepository.save).not.toHaveBeenCalled();
    });

    it('saves the change and enqueues a Channex restrictions push', async () => {
      ratePeriodRepository.findOne.mockResolvedValue({
        id: 'period-1',
        startDate: '2026-06-01',
        endDate: '2026-09-15',
        price: 199,
      });

      await service.update('resort-1', 'feature-1', 'period-1', { price: 249 });

      expect(ratePeriodRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ price: 249 }),
      );
      expect(channexAriProducer.enqueueRestrictionsPush).toHaveBeenCalledWith(
        'feature-1',
      );
    });
  });

  describe('remove', () => {
    it('deletes the period and enqueues a Channex restrictions push', async () => {
      ratePeriodRepository.findOne.mockResolvedValue({ id: 'period-1' });

      await service.remove('resort-1', 'feature-1', 'period-1');

      expect(ratePeriodRepository.delete).toHaveBeenCalledWith('period-1');
      expect(channexAriProducer.enqueueRestrictionsPush).toHaveBeenCalledWith(
        'feature-1',
      );
    });

    it('throws instead of deleting when the period does not exist', async () => {
      ratePeriodRepository.findOne.mockResolvedValue(null);

      await expect(
        service.remove('resort-1', 'feature-1', 'missing'),
      ).rejects.toThrow(NotFoundException);
      expect(ratePeriodRepository.delete).not.toHaveBeenCalled();
      expect(channexAriProducer.enqueueRestrictionsPush).not.toHaveBeenCalled();
    });
  });
});
