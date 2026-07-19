import { Test, TestingModule } from '@nestjs/testing';
import { ResortUserController } from './resort-user.controller';
import { ResortUserService } from './resort-user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ResortMemberGuard } from './guards/resort-member.guard';

describe('ResortUserController', () => {
    let controller: ResortUserController;
    let service: { create: jest.Mock; findAll: jest.Mock; findOne: jest.Mock; replace: jest.Mock; update: jest.Mock; remove: jest.Mock };

    beforeEach(async () => {
        service = {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            replace: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [ResortUserController],
            providers: [{ provide: ResortUserService, useValue: service }],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({ canActivate: () => true })
            .overrideGuard(ResortMemberGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get<ResortUserController>(ResortUserController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it('delegates create to the service', () => {
        const dto = { name: 'Jane', email: 'jane@example.com', password: 'password123' };
        controller.create('resort-1', dto);
        expect(service.create).toHaveBeenCalledWith('resort-1', dto);
    });

    it('delegates findAll to the service', () => {
        controller.findAll('resort-1');
        expect(service.findAll).toHaveBeenCalledWith('resort-1');
    });

    it('delegates findOne to the service', () => {
        controller.findOne('resort-1', 'user-1');
        expect(service.findOne).toHaveBeenCalledWith('resort-1', 'user-1');
    });

    it('delegates replace to the service', () => {
        const dto = { name: 'Jane', email: 'jane@example.com', password: 'password123' };
        controller.replace('resort-1', 'user-1', dto);
        expect(service.replace).toHaveBeenCalledWith('resort-1', 'user-1', dto);
    });

    it('delegates update to the service', () => {
        const dto = { name: 'New Name' };
        controller.update('resort-1', 'user-1', dto);
        expect(service.update).toHaveBeenCalledWith('resort-1', 'user-1', dto);
    });

    it('delegates remove to the service', () => {
        controller.remove('resort-1', 'user-1');
        expect(service.remove).toHaveBeenCalledWith('resort-1', 'user-1');
    });
});
