import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { ResortController } from './resort.controller';
import { ResortService } from './resort.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ResortOwnerGuard } from './guards/resort-owner.guard';
import { ResortMemberGuard } from './guards/resort-member.guard';
import type { JwtPayload } from '../auth/jwt-payload.interface';

describe('ResortController', () => {
  let controller: ResortController;
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
      controllers: [ResortController],
      providers: [{ provide: ResortService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(ResortOwnerGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(ResortMemberGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<ResortController>(ResortController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates create to the service with the authenticated user id', async () => {
    const dto = { name: 'Sunset Bay', phoneNumber: '123' };
    const request = {
      user: { sub: 'user-1', email: 'a@b.com', role: 'Owner', resortId: null },
    } as unknown as Request & { user: JwtPayload };
    service.create.mockResolvedValue({
      id: 'resort-1',
      name: 'Sunset Bay',
      phoneNumber: '123',
    });

    await controller.create(dto, request);

    expect(service.create).toHaveBeenCalledWith(dto, 'user-1');
  });

  it('delegates findAll to the service', async () => {
    service.findAll.mockResolvedValue([
      { id: 'resort-1', name: 'Sunset Bay', phoneNumber: '123' },
    ]);

    await controller.findAll();

    expect(service.findAll).toHaveBeenCalled();
  });

  it('delegates findOne to the service', async () => {
    service.findOne.mockResolvedValue({
      id: 'resort-1',
      name: 'Sunset Bay',
      phoneNumber: '123',
    });

    await controller.findOne('1');

    expect(service.findOne).toHaveBeenCalledWith('1');
  });

  it('delegates update to the service', async () => {
    const dto = { name: 'New Name' };
    service.update.mockResolvedValue({
      id: 'resort-1',
      name: 'New Name',
      phoneNumber: '123',
    });

    await controller.update('1', dto);

    expect(service.update).toHaveBeenCalledWith('1', dto);
  });

  it('delegates remove to the service', async () => {
    await controller.remove('1');
    expect(service.remove).toHaveBeenCalledWith('1');
  });
});
