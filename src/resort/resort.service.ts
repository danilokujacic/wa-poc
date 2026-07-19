import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ResortRepository } from '../repository/resort.repository';
import { UserRepository } from '../repository/user.repository';
import { Resort } from '../entity/resort.entity';
import { CreateResortDto } from './dto/create-resort.dto';
import { UpdateResortDto } from './dto/update-resort.dto';

@Injectable()
export class ResortService {
    constructor(
        private readonly resortRepository: ResortRepository,
        private readonly userRepository: UserRepository,
    ) { }

    async create(createResortDto: CreateResortDto, ownerId: string): Promise<Resort> {
        const owner = await this.userRepository.findOne({
            where: { id: ownerId },
            relations: { resort: true },
        });
        if (!owner) {
            throw new NotFoundException(`User with id ${ownerId} not found`);
        }
        if (owner.resort) {
            throw new ConflictException('User is already tied to a resort');
        }

        const resort = await this.resortRepository.save(this.resortRepository.create(createResortDto));

        owner.resort = resort;
        await this.userRepository.save(owner);

        return resort;
    }

    findAll(): Promise<Resort[]> {
        return this.resortRepository.find();
    }

    async findOne(id: string): Promise<Resort> {
        const resort = await this.resortRepository.findOneBy({ id });
        if (!resort) {
            throw new NotFoundException(`Resort with id ${id} not found`);
        }
        return resort;
    }

    async update(id: string, updateResortDto: UpdateResortDto): Promise<Resort> {
        const resort = await this.findOne(id);
        Object.assign(resort, updateResortDto);
        return this.resortRepository.save(resort);
    }

    async remove(id: string): Promise<void> {
        const resort = await this.findOne(id);
        await this.resortRepository.remove(resort);
    }
}
