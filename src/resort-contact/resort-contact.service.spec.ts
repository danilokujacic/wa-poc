import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ResortContactService } from './resort-contact.service';
import { ResortContactRepository } from '../repository/resort-contact.repository';
import { ContactType } from '../entity/resort-contact.entity';

describe('ResortContactService', () => {
    let service: ResortContactService;
    let repository: { create: jest.Mock; save: jest.Mock; find: jest.Mock; findOne: jest.Mock; remove: jest.Mock };

    beforeEach(async () => {
        repository = {
            create: jest.fn((dto) => dto),
            save: jest.fn(async (entity) => entity),
            find: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ResortContactService,
                { provide: ResortContactRepository, useValue: repository },
            ],
        }).compile();

        service = module.get<ResortContactService>(ResortContactService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('creates a contact for a resort', async () => {
        const dto = { contact_name: 'Front Desk', type: ContactType.PHONE, contact: '+382 69 123 456' };

        const result = await service.create('resort-1', dto);

        expect(repository.create).toHaveBeenCalledWith({
            ...dto,
            resort: { id: 'resort-1' },
        });
        expect(repository.save).toHaveBeenCalled();
        expect(result).toEqual({ ...dto, resort: { id: 'resort-1' } });
    });

    it('returns all contacts for a resort', async () => {
        const contacts = [{ id: '1', contact_name: 'Front Desk', type: ContactType.PHONE, contact: '+382 69 123 456' }];
        repository.find.mockResolvedValue(contacts);

        const result = await service.findAll('resort-1', {});

        expect(repository.find).toHaveBeenCalledWith({ where: { resort: { id: 'resort-1' } } });
        expect(result).toBe(contacts);
    });

    it('searches both contact_name and contact, case-insensitively', async () => {
        const contacts = [{ id: '1', contact_name: 'Front Desk', type: ContactType.PHONE, contact: '+382 69 123 456' }];
        repository.find.mockResolvedValue(contacts);

        const result = await service.findAll('resort-1', { search: 'front' });

        expect(repository.find).toHaveBeenCalledWith({
            where: [
                { resort: { id: 'resort-1' }, contact_name: expect.anything() },
                { resort: { id: 'resort-1' }, contact: expect.anything() },
            ],
        });
        expect(result).toBe(contacts);
    });

    it('returns a contact by id scoped to its resort', async () => {
        const contact = { id: '1', contact_name: 'Front Desk', type: ContactType.PHONE, contact: '+382 69 123 456' };
        repository.findOne.mockResolvedValue(contact);

        const result = await service.findOne('resort-1', '1');

        expect(repository.findOne).toHaveBeenCalledWith({ where: { id: '1', resort: { id: 'resort-1' } } });
        expect(result).toBe(contact);
    });

    it('throws when a contact is not found for that resort', async () => {
        repository.findOne.mockResolvedValue(null);

        await expect(service.findOne('resort-1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('updates a contact', async () => {
        const contact = { id: '1', contact_name: 'Front Desk', type: ContactType.PHONE, contact: '+382 69 123 456' };
        repository.findOne.mockResolvedValue(contact);

        const result = await service.update('resort-1', '1', { contact: '+382 69 999 999' });

        expect(repository.save).toHaveBeenCalledWith({ ...contact, contact: '+382 69 999 999' });
        expect(result.contact).toBe('+382 69 999 999');
    });

    it('removes a contact', async () => {
        const contact = { id: '1', contact_name: 'Front Desk', type: ContactType.PHONE, contact: '+382 69 123 456' };
        repository.findOne.mockResolvedValue(contact);

        await service.remove('resort-1', '1');

        expect(repository.remove).toHaveBeenCalledWith(contact);
    });
});
