import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { UsersController } from './users.controller';
import { ResortUserService } from './resort-user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { UserRole } from '../entity/user.entity';

describe('UsersController', () => {
  let controller: UsersController;
  let service: { findMe: jest.Mock };

  beforeEach(async () => {
    service = {
      findMe: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: ResortUserService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates to findMe with the authenticated user id and maps to a response dto', async () => {
    const user = {
      id: 'user-1',
      name: 'Jane',
      email: 'jane@example.com',
      role: UserRole.EMPLOYEE,
      emailConfirmed: true,
      resort: null,
    };
    service.findMe.mockResolvedValue(user);
    const request = {
      user: {
        sub: 'user-1',
        email: 'jane@example.com',
        role: UserRole.EMPLOYEE,
        resortId: null,
      },
    } as Request & { user: JwtPayload };

    const result = await controller.me(request);

    expect(service.findMe).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({
      id: 'user-1',
      name: 'Jane',
      email: 'jane@example.com',
      role: UserRole.EMPLOYEE,
      emailConfirmed: true,
      resort: null,
    });
  });
});
