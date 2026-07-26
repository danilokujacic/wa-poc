import { Injectable, NotFoundException } from '@nestjs/common';
import { FindOptionsWhere, ILike } from 'typeorm';
import { ResortContactRepository } from '../repository/resort-contact.repository';
import { ResortContact } from '../entity/resort-contact.entity';
import { CreateResortContactDto } from './dto/create-resort-contact.dto';
import { UpdateResortContactDto } from './dto/update-resort-contact.dto';
import { FindResortContactsQueryDto } from './dto/find-resort-contacts-query.dto';

@Injectable()
export class ResortContactService {
    constructor(private readonly resortContactRepository: ResortContactRepository) { }

    create(resortId: string, createResortContactDto: CreateResortContactDto): Promise<ResortContact> {
        const contact = this.resortContactRepository.create({
            ...createResortContactDto,
            resort: { id: resortId } as ResortContact['resort'],
        });
        return this.resortContactRepository.save(contact);
    }

    findAll(resortId: string, { search = '' }: FindResortContactsQueryDto): Promise<ResortContact[]> {
        const where: FindOptionsWhere<ResortContact> | FindOptionsWhere<ResortContact>[] = search
            ? [
                { resort: { id: resortId }, contact_name: ILike(`%${search}%`) },
                { resort: { id: resortId }, contact: ILike(`%${search}%`) },
            ]
            : { resort: { id: resortId } };

        return this.resortContactRepository.find({ where });
    }

    async findOne(resortId: string, id: string): Promise<ResortContact> {
        const contact = await this.resortContactRepository.findOne({
            where: { id, resort: { id: resortId } },
        });
        if (!contact) {
            throw new NotFoundException(`Contact with id ${id} not found for resort ${resortId}`);
        }
        return contact;
    }

    async update(resortId: string, id: string, updateResortContactDto: UpdateResortContactDto): Promise<ResortContact> {
        const contact = await this.findOne(resortId, id);
        Object.assign(contact, updateResortContactDto);
        return this.resortContactRepository.save(contact);
    }

    async remove(resortId: string, id: string): Promise<void> {
        const contact = await this.findOne(resortId, id);
        await this.resortContactRepository.remove(contact);
    }
}
