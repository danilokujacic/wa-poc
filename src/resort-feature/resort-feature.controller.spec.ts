import { Test, TestingModule } from '@nestjs/testing';
import { ResortFeatureController } from './resort-feature.controller';
import { ResortFeatureService } from './resort-feature.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ResortMemberGuard } from '../resort/guards/resort-member.guard';
import { ResortOwnerGuard } from '../resort/guards/resort-owner.guard';

describe('ResortFeatureController', () => {
  let controller: ResortFeatureController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ResortFeatureController],
      providers: [{ provide: ResortFeatureService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ResortMemberGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ResortOwnerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ResortFeatureController>(ResortFeatureController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates create to the service', async () => {
    const dto = { name: 'Cabana', price: 49.99, quantity: 5, capacity: 2 };
    service.create.mockResolvedValue({ id: 'feature-1', ...dto });

    await controller.create('resort-1', dto);

    expect(service.create).toHaveBeenCalledWith('resort-1', dto);
  });

  it('delegates findAll to the service', async () => {
    service.findAll.mockResolvedValue([
      {
        id: 'feature-1',
        name: 'Cabana',
        price: 49.99,
        quantity: 5,
        capacity: 2,
      },
    ]);

    await controller.findAll('resort-1');

    expect(service.findAll).toHaveBeenCalledWith('resort-1');
  });

  it('delegates findOne to the service', async () => {
    service.findOne.mockResolvedValue({
      id: 'feature-1',
      name: 'Cabana',
      price: 49.99,
      quantity: 5,
      capacity: 2,
    });

    await controller.findOne('resort-1', 'feature-1');

    expect(service.findOne).toHaveBeenCalledWith('resort-1', 'feature-1');
  });

  it('delegates update to the service', async () => {
    const dto = { price: 59.99 };
    service.update.mockResolvedValue({
      id: 'feature-1',
      name: 'Cabana',
      price: 59.99,
      quantity: 5,
      capacity: 2,
    });

    await controller.update('resort-1', 'feature-1', dto);

    expect(service.update).toHaveBeenCalledWith('resort-1', 'feature-1', dto);
  });

  it('delegates remove to the service', async () => {
    await controller.remove('resort-1', 'feature-1');
    expect(service.remove).toHaveBeenCalledWith('resort-1', 'feature-1');
  });
});
