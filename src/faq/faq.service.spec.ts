import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FaqService } from './faq.service';
import { FaqRepository } from '../repository/faq.repository';

describe('FaqService', () => {
    let service: FaqService;
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
                FaqService,
                { provide: FaqRepository, useValue: repository },
            ],
        }).compile();

        service = module.get<FaqService>(FaqService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('creates a faq for a resort', async () => {
        const dto = { question: 'Where?', answer: 'Here' };

        const result = await service.create('resort-1', dto);

        expect(repository.create).toHaveBeenCalledWith({
            question: 'Where?',
            answer: 'Here',
            resort: { id: 'resort-1' },
        });
        expect(repository.save).toHaveBeenCalled();
        expect(result).toEqual({
            question: 'Where?',
            answer: 'Here',
            resort: { id: 'resort-1' },
        });
    });

    it('returns all faqs for a resort', async () => {
        const faqs = [{ id: 1, question: 'Where?', answer: 'Here' }];
        repository.find.mockResolvedValue(faqs);

        const result = await service.findAll('resort-1');

        expect(repository.find).toHaveBeenCalledWith({ where: { resort: { id: 'resort-1' } } });
        expect(result).toBe(faqs);
    });

    it('returns a faq by id scoped to its resort', async () => {
        const faq = { id: 1, question: 'Where?', answer: 'Here' };
        repository.findOne.mockResolvedValue(faq);

        const result = await service.findOne('resort-1', 1);

        expect(repository.findOne).toHaveBeenCalledWith({ where: { id: 1, resort: { id: 'resort-1' } } });
        expect(result).toBe(faq);
    });

    it('throws when a faq is not found for that resort', async () => {
        repository.findOne.mockResolvedValue(null);

        await expect(service.findOne('resort-1', 999)).rejects.toThrow(NotFoundException);
    });

    it('updates a faq', async () => {
        const faq = { id: 1, question: 'Where?', answer: 'Here' };
        repository.findOne.mockResolvedValue(faq);

        const result = await service.update('resort-1', 1, { answer: 'New answer' });

        expect(repository.save).toHaveBeenCalledWith({ ...faq, answer: 'New answer' });
        expect(result.answer).toBe('New answer');
    });

    it('removes a faq', async () => {
        const faq = { id: 1, question: 'Where?', answer: 'Here' };
        repository.findOne.mockResolvedValue(faq);

        await service.remove('resort-1', 1);

        expect(repository.remove).toHaveBeenCalledWith(faq);
    });
});
