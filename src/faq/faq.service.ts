import { Injectable, NotFoundException } from '@nestjs/common';
import { FindOptionsWhere, ILike } from 'typeorm';
import { FaqRepository } from '../repository/faq.repository';
import { Faq } from '../entity/faq.entity';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';
import { FaqSortableField, FindFaqsQueryDto } from './dto/find-faqs-query.dto';

export interface PaginatedFaqs {
    data: Faq[];
    total: number;
    page: number;
    limit: number;
}

@Injectable()
export class FaqService {
    constructor(private readonly faqRepository: FaqRepository) { }

    create(resortId: string, createFaqDto: CreateFaqDto): Promise<Faq> {
        const faq = this.faqRepository.create({
            ...createFaqDto,
            resort: { id: resortId } as Faq['resort'],
        });
        return this.faqRepository.save(faq);
    }

    async findAll(resortId: string, { search = '', sortBy = FaqSortableField.ID, sortOrder = 'ASC', page = 1, limit = 10 }: FindFaqsQueryDto): Promise<PaginatedFaqs> {
        const where: FindOptionsWhere<Faq> | FindOptionsWhere<Faq>[] = search
            ? [
                { resort: { id: resortId }, question: ILike(`%${search}%`) },
                { resort: { id: resortId }, answer: ILike(`%${search}%`) },
            ]
            : { resort: { id: resortId } };

        const [data, total] = await this.faqRepository.findAndCount({
            where,
            order: { [sortBy]: sortOrder },
            skip: (page - 1) * limit,
            take: limit,
        });

        return { data, total, page, limit };
    }

    async findOne(resortId: string, id: number): Promise<Faq> {
        const faq = await this.faqRepository.findOne({
            where: { id, resort: { id: resortId } },
        });
        if (!faq) {
            throw new NotFoundException(`Faq with id ${id} not found for resort ${resortId}`);
        }
        return faq;
    }

    async update(resortId: string, id: number, updateFaqDto: UpdateFaqDto): Promise<Faq> {
        const faq = await this.findOne(resortId, id);
        Object.assign(faq, updateFaqDto);
        return this.faqRepository.save(faq);
    }

    async remove(resortId: string, id: number): Promise<void> {
        const faq = await this.findOne(resortId, id);
        await this.faqRepository.remove(faq);
    }
}
