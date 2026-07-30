import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ResortFeatureRepository } from '../repository/resort-feature.repository';
import { ReservationRepository } from '../repository/reservation.repository';
import { ResortFeature } from '../entity/resort-feature.entity';
import { Resort } from '../entity/resort.entity';
import { ChannexContentSyncService } from '../channex/channex-content-sync.service';
import { CreateResortFeatureDto } from './dto/create-resort-feature.dto';
import { UpdateResortFeatureDto } from './dto/update-resort-feature.dto';

@Injectable()
export class ResortFeatureService {
    private readonly logger = new Logger(ResortFeatureService.name);

    constructor(
        private readonly resortFeatureRepository: ResortFeatureRepository,
        private readonly reservationRepository: ReservationRepository,
        private readonly channexContentSyncService: ChannexContentSyncService,
    ) { }

    // Runs the local write and the Channex push in one DB transaction: if the
    // Channex call throws, the transaction rolls back so the feature is never
    // left persisted locally without also existing in Channex. The inverse
    // (Channex succeeds but the transaction fails to commit afterwards, leaving
    // an orphan room type in Channex) is a much smaller window and isn't
    // solvable without a distributed transaction/outbox — not attempted here.
    create(resortId: string, createResortFeatureDto: CreateResortFeatureDto): Promise<ResortFeature> {
        return this.resortFeatureRepository.manager.transaction(async (manager) => {
            const resort = await this.loadResort(manager, resortId);

            const feature = manager.create(ResortFeature, {
                ...createResortFeatureDto,
                resort: { id: resortId } as ResortFeature['resort'],
            });
            await manager.save(feature);

            if (resort.channexPropertyId) {
                feature.channexRoomTypeId = await this.channexContentSyncService.syncRoomType(resort, feature);
                await manager.save(feature);
            }

            return feature;
        });
    }

    findAll(resortId: string): Promise<ResortFeature[]> {
        return this.resortFeatureRepository.find({ where: { resort: { id: resortId }, isActive: true } });
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

    update(resortId: string, id: string, updateResortFeatureDto: UpdateResortFeatureDto): Promise<ResortFeature> {
        return this.resortFeatureRepository.manager.transaction(async (manager) => {
            const feature = await manager.findOne(ResortFeature, {
                where: { id, resort: { id: resortId } },
                relations: { resort: true },
            });
            if (!feature) {
                throw new NotFoundException(`Feature with id ${id} not found for resort ${resortId}`);
            }

            Object.assign(feature, updateResortFeatureDto);
            await manager.save(feature);

            if (feature.resort.channexPropertyId) {
                feature.channexRoomTypeId = await this.channexContentSyncService.syncRoomType(feature.resort, feature);
                await manager.save(feature);
            }

            return feature;
        });
    }

    async remove(resortId: string, id: string): Promise<void> {
        const feature = await this.findOne(resortId, id);
        feature.isActive = false;
        await this.resortFeatureRepository.save(feature);
        await this.reservationRepository.declinePendingForFeature(id);

        if (feature.channexRoomTypeId) {
            // Channex has no API to delete a room type — the mapping stays as-is.
            this.logger.warn(
                `Feature ${id} was deactivated locally but Channex room type ${feature.channexRoomTypeId} was left untouched — ` +
                `pause it (stop sell / disconnect channels) manually in the Channex dashboard if it should stop selling`,
            );
        }
    }

    private async loadResort(manager: EntityManager, resortId: string): Promise<Resort> {
        const resort = await manager.findOne(Resort, { where: { id: resortId } });
        if (!resort) {
            throw new NotFoundException(`Resort with id ${resortId} not found`);
        }
        return resort;
    }
}
