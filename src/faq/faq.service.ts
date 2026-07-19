import { Injectable, NotFoundException } from '@nestjs/common';
import { FaqRepository } from '../repository/faq.repository';
import { Faq } from '../entity/faq.entity';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';

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

    findAll(resortId: string): Promise<Faq[]> {
        return this.faqRepository.find({ where: { resort: { id: resortId } } });
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
