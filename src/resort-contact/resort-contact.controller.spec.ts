import { Test, TestingModule } from '@nestjs/testing';
import { ResortContactController } from './resort-contact.controller';
import { ResortContactService } from './resort-contact.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ResortMemberGuard } from '../resort/guards/resort-member.guard';
import { ResortOwnerGuard } from '../resort/guards/resort-owner.guard';
import { ContactType } from '../entity/resort-contact.entity';

describe('ResortContactController', () => {
    let controller: ResortContactController;
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
            controllers: [ResortContactController],
            providers: [{ provide: ResortContactService, useValue: service }],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({ canActivate: () => true })
            .overrideGuard(ResortMemberGuard)
            .useValue({ canActivate: () => true })
            .overrideGuard(ResortOwnerGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get<ResortContactController>(ResortContactController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it('delegates create to the service', async () => {
        const dto = { contact_name: 'Front Desk', type: ContactType.PHONE, contact: '+382 69 123 456' };
        service.create.mockResolvedValue({ id: 'contact-1', ...dto });

        await controller.create('resort-1', dto);

        expect(service.create).toHaveBeenCalledWith('resort-1', dto);
    });

    it('delegates findAll to the service', async () => {
        service.findAll.mockResolvedValue([{ id: 'contact-1', contact_name: 'Front Desk', type: ContactType.PHONE, contact: '+382 69 123 456' }]);

        await controller.findAll('resort-1', {});

        expect(service.findAll).toHaveBeenCalledWith('resort-1', {});
    });

    it('delegates findOne to the service', async () => {
        service.findOne.mockResolvedValue({ id: 'contact-1', contact_name: 'Front Desk', type: ContactType.PHONE, contact: '+382 69 123 456' });

        await controller.findOne('resort-1', 'contact-1');

        expect(service.findOne).toHaveBeenCalledWith('resort-1', 'contact-1');
    });

    it('delegates update to the service', async () => {
        const dto = { contact: '+382 69 999 999' };
        service.update.mockResolvedValue({ id: 'contact-1', contact_name: 'Front Desk', type: ContactType.PHONE, contact: '+382 69 999 999' });

        await controller.update('resort-1', 'contact-1', dto);

        expect(service.update).toHaveBeenCalledWith('resort-1', 'contact-1', dto);
    });

    it('delegates remove to the service', () => {
        controller.remove('resort-1', 'contact-1');
        expect(service.remove).toHaveBeenCalledWith('resort-1', 'contact-1');
    });
});
