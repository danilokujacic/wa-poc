import { Test, TestingModule } from '@nestjs/testing';
import { FaqController } from './faq.controller';
import { FaqService } from './faq.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ResortMemberGuard } from '../resort/guards/resort-member.guard';

describe('FaqController', () => {
    let controller: FaqController;
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
            controllers: [FaqController],
            providers: [{ provide: FaqService, useValue: service }],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({ canActivate: () => true })
            .overrideGuard(ResortMemberGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get<FaqController>(FaqController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it('delegates create to the service', () => {
        const dto = { question: 'Where?', answer: 'Here' };
        controller.create('resort-1', dto);
        expect(service.create).toHaveBeenCalledWith('resort-1', dto);
    });

    it('delegates findAll to the service', () => {
        controller.findAll('resort-1');
        expect(service.findAll).toHaveBeenCalledWith('resort-1');
    });

    it('delegates findOne to the service', () => {
        controller.findOne('resort-1', 1);
        expect(service.findOne).toHaveBeenCalledWith('resort-1', 1);
    });

    it('delegates update to the service', () => {
        const dto = { answer: 'New answer' };
        controller.update('resort-1', 1, dto);
        expect(service.update).toHaveBeenCalledWith('resort-1', 1, dto);
    });

    it('delegates remove to the service', () => {
        controller.remove('resort-1', 1);
        expect(service.remove).toHaveBeenCalledWith('resort-1', 1);
    });
});
