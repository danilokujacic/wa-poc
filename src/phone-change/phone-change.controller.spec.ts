import { Test, TestingModule } from '@nestjs/testing';
import { PhoneChangeController } from './phone-change.controller';
import { PhoneChangeService } from './phone-change.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ResortOwnerGuard } from '../resort/guards/resort-owner.guard';

describe('PhoneChangeController', () => {
  let controller: PhoneChangeController;
  let service: { create: jest.Mock };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PhoneChangeController],
      providers: [{ provide: PhoneChangeService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ResortOwnerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PhoneChangeController>(PhoneChangeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates create to the service and maps the result to a response dto', async () => {
    const phoneChange = {
      id: 'pc-1',
      oldPhoneNumber: '+382 1',
      newPhoneNumber: '+382 69 111 111',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    service.create.mockResolvedValue(phoneChange);

    const result = await controller.create('resort-1', {
      newPhoneNumber: '+382 69 111 111',
    });

    expect(service.create).toHaveBeenCalledWith('resort-1', '+382 69 111 111');
    expect(result).toEqual({
      id: 'pc-1',
      oldPhoneNumber: '+382 1',
      newPhoneNumber: '+382 69 111 111',
      createdAt: phoneChange.createdAt,
    });
  });
});
