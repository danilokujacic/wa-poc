import { Test, TestingModule } from '@nestjs/testing';
import { RatePeriodController } from './rate-period.controller';
import { RatePeriodService } from './rate-period.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ResortMemberGuard } from '../resort/guards/resort-member.guard';
import { ResortOwnerGuard } from '../resort/guards/resort-owner.guard';

describe('RatePeriodController', () => {
  let controller: RatePeriodController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  const period = {
    id: 'period-1',
    name: 'Summer 2026',
    startDate: '2026-06-01',
    endDate: '2026-09-15',
    price: 199,
    minStay: null,
    stopSell: false,
    closedToArrival: false,
    closedToDeparture: false,
    priority: 0,
  };

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue(period),
      findAll: jest.fn().mockResolvedValue([period]),
      findOne: jest.fn().mockResolvedValue(period),
      update: jest.fn().mockResolvedValue({ ...period, price: 249 }),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RatePeriodController],
      providers: [{ provide: RatePeriodService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ResortMemberGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ResortOwnerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<RatePeriodController>(RatePeriodController);
  });

  it('creates a rate period and returns it via the response DTO shape', async () => {
    const dto = {
      name: 'Summer 2026',
      startDate: '2026-06-01',
      endDate: '2026-09-15',
      price: 199,
    };
    const result = await controller.create('resort-1', 'feature-1', dto);

    expect(service.create).toHaveBeenCalledWith('resort-1', 'feature-1', dto);
    expect(result.id).toBe('period-1');
    expect(result.price).toBe(199);
  });

  it('lists all rate periods for a feature', async () => {
    const result = await controller.findAll('resort-1', 'feature-1');

    expect(service.findAll).toHaveBeenCalledWith('resort-1', 'feature-1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('period-1');
  });

  it('gets a single rate period', async () => {
    const result = await controller.findOne(
      'resort-1',
      'feature-1',
      'period-1',
    );

    expect(service.findOne).toHaveBeenCalledWith(
      'resort-1',
      'feature-1',
      'period-1',
    );
    expect(result.id).toBe('period-1');
  });

  it('updates a rate period', async () => {
    const result = await controller.update(
      'resort-1',
      'feature-1',
      'period-1',
      { price: 249 },
    );

    expect(service.update).toHaveBeenCalledWith(
      'resort-1',
      'feature-1',
      'period-1',
      { price: 249 },
    );
    expect(result.price).toBe(249);
  });

  it('removes a rate period', async () => {
    await controller.remove('resort-1', 'feature-1', 'period-1');

    expect(service.remove).toHaveBeenCalledWith(
      'resort-1',
      'feature-1',
      'period-1',
    );
  });
});
