import { Test, TestingModule } from '@nestjs/testing';
import { ReservationController } from './reservation.controller';
import { ReservationService } from './reservation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ResortMemberGuard } from '../resort/guards/resort-member.guard';
import { ReservationStatus } from '../entity/reservation.entity';

describe('ReservationController', () => {
    let controller: ReservationController;
    let service: { create: jest.Mock; findAll: jest.Mock; findOne: jest.Mock; update: jest.Mock; remove: jest.Mock };

    beforeEach(async () => {
        service = {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [ReservationController],
            providers: [{ provide: ReservationService, useValue: service }],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({ canActivate: () => true })
            .overrideGuard(ResortMemberGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get<ReservationController>(ReservationController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it('delegates create to the service', () => {
        const dto = { featureId: 'feature-1', startDate: '2026-08-01', endDate: '2026-08-03', phoneNumber: '123' };
        controller.create('resort-1', dto);
        expect(service.create).toHaveBeenCalledWith('resort-1', dto);
    });

    it('delegates findAll to the service', () => {
        controller.findAll('resort-1');
        expect(service.findAll).toHaveBeenCalledWith('resort-1');
    });

    it('delegates findOne to the service', () => {
        controller.findOne('resort-1', 'reservation-1');
        expect(service.findOne).toHaveBeenCalledWith('resort-1', 'reservation-1');
    });

    it('delegates update to the service', () => {
        const dto = { status: ReservationStatus.ACCEPTED };
        controller.update('resort-1', 'reservation-1', dto);
        expect(service.update).toHaveBeenCalledWith('resort-1', 'reservation-1', dto);
    });

    it('delegates remove to the service', () => {
        controller.remove('resort-1', 'reservation-1');
        expect(service.remove).toHaveBeenCalledWith('resort-1', 'reservation-1');
    });
});
