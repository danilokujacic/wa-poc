import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ResortUserService } from './resort-user.service';
import { UserRepository } from '../repository/user.repository';
import { ResortRepository } from '../repository/resort.repository';
import { UserRole } from '../entity/user.entity';
import { EmailConfirmationService } from '../email-confirmation/email-confirmation.service';

describe('ResortUserService', () => {
    let service: ResortUserService;
    let userRepository: { create: jest.Mock; save: jest.Mock; find: jest.Mock; findOne: jest.Mock; findByEmail: jest.Mock; remove: jest.Mock };
    let resortRepository: { findOneBy: jest.Mock };
    let emailConfirmationService: { createAndSend: jest.Mock };

    beforeEach(async () => {
        userRepository = {
            create: jest.fn((dto) => dto),
            save: jest.fn(async (entity) => ({ id: 'user-1', ...entity })),
            find: jest.fn(),
            findOne: jest.fn(),
            findByEmail: jest.fn(),
            remove: jest.fn(),
        };
        resortRepository = {
            findOneBy: jest.fn(),
        };
        emailConfirmationService = {
            createAndSend: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ResortUserService,
                { provide: UserRepository, useValue: userRepository },
                { provide: ResortRepository, useValue: resortRepository },
                { provide: EmailConfirmationService, useValue: emailConfirmationService },
            ],
        }).compile();

        service = module.get<ResortUserService>(ResortUserService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('creates an employee tied to the resort', async () => {
        resortRepository.findOneBy.mockResolvedValue({ id: 'resort-1' });
        userRepository.findByEmail.mockResolvedValue(null);

        const result = await service.create('resort-1', {
            name: 'Jane Doe',
            email: 'jane@example.com',
            password: 'password123',
        });

        expect(userRepository.create).toHaveBeenCalledWith(
            expect.objectContaining({ role: UserRole.EMPLOYEE, resort: { id: 'resort-1' } }),
        );
        expect(result.role).toBe(UserRole.EMPLOYEE);
    });

    it('throws when the resort does not exist on create', async () => {
        resortRepository.findOneBy.mockResolvedValue(null);

        await expect(
            service.create('missing-resort', { name: 'Jane', email: 'jane@example.com', password: 'password123' }),
        ).rejects.toThrow(NotFoundException);
    });

    it('throws when the email is already taken on create', async () => {
        resortRepository.findOneBy.mockResolvedValue({ id: 'resort-1' });
        userRepository.findByEmail.mockResolvedValue({ id: 'existing' });

        await expect(
            service.create('resort-1', { name: 'Jane', email: 'jane@example.com', password: 'password123' }),
        ).rejects.toThrow(ConflictException);
    });

    it('lists users for a resort', async () => {
        resortRepository.findOneBy.mockResolvedValue({ id: 'resort-1' });
        userRepository.find.mockResolvedValue([{ id: 'user-1', password: 'hash' }]);

        const result = await service.findAll('resort-1');

        expect(userRepository.find).toHaveBeenCalledWith({ where: { resort: { id: 'resort-1' } } });
        expect(result[0].id).toBe('user-1');
    });

    it('throws when getting one user that does not belong to the resort', async () => {
        userRepository.findOne.mockResolvedValue(null);

        await expect(service.findOne('resort-1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('replaces a user', async () => {
        userRepository.findOne.mockResolvedValue({ id: 'user-1', name: 'Old', email: 'old@example.com', password: 'hash' });

        const result = await service.replace('resort-1', 'user-1', {
            name: 'New Name',
            email: 'new@example.com',
            password: 'password123',
        });

        expect(result.name).toBe('New Name');
        expect(result.email).toBe('new@example.com');
    });

    it('partially updates a user', async () => {
        userRepository.findOne.mockResolvedValue({ id: 'user-1', name: 'Old', email: 'old@example.com', password: 'hash' });

        const result = await service.update('resort-1', 'user-1', { name: 'New Name' });

        expect(result.name).toBe('New Name');
        expect(result.email).toBe('old@example.com');
    });

    it('removes a user', async () => {
        const user = { id: 'user-1', name: 'Jane', email: 'jane@example.com', password: 'hash' };
        userRepository.findOne.mockResolvedValue(user);

        await service.remove('resort-1', 'user-1');

        expect(userRepository.remove).toHaveBeenCalledWith(user);
    });
});
