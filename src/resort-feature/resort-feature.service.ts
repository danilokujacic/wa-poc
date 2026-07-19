import { Injectable, NotFoundException } from '@nestjs/common';
import { ResortFeatureRepository } from '../repository/resort-feature.repository';
import { ResortFeature } from '../entity/resort-feature.entity';
import { CreateResortFeatureDto } from './dto/create-resort-feature.dto';
import { UpdateResortFeatureDto } from './dto/update-resort-feature.dto';

@Injectable()
export class ResortFeatureService {
    constructor(private readonly resortFeatureRepository: ResortFeatureRepository) { }

    create(resortId: string, createResortFeatureDto: CreateResortFeatureDto): Promise<ResortFeature> {
        const feature = this.resortFeatureRepository.create({
            ...createResortFeatureDto,
            resort: { id: resortId } as ResortFeature['resort'],
        });
        return this.resortFeatureRepository.save(feature);
    }

    findAll(resortId: string): Promise<ResortFeature[]> {
        return this.resortFeatureRepository.find({ where: { resort: { id: resortId } } });
    }

    async findOne(resortId: string, id: string): Promise<ResortFeature> {
        const feature = await this.resortFeatureRepository.findOne({
            where: { id, resort: { id: resortId } },
        });
        if (!feature) {
            throw new NotFoundException(`Feature with id ${id} not found for resort ${resortId}`);
        }
        return feature;
    }

    async update(resortId: string, id: string, updateResortFeatureDto: UpdateResortFeatureDto): Promise<ResortFeature> {
        const feature = await this.findOne(resortId, id);
        Object.assign(feature, updateResortFeatureDto);
        return this.resortFeatureRepository.save(feature);
    }

    async remove(resortId: string, id: string): Promise<void> {
        const feature = await this.findOne(resortId, id);
        await this.resortFeatureRepository.remove(feature);
    }
}
