import { Injectable, NotFoundException } from '@nestjs/common';
import { ReservationRepository } from '../repository/reservation.repository';
import { ResortFeatureRepository } from '../repository/resort-feature.repository';
import { Reservation } from '../entity/reservation.entity';
import { ResortFeature } from '../entity/resort-feature.entity';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';

@Injectable()
export class ReservationService {
    constructor(
        private readonly reservationRepository: ReservationRepository,
        private readonly resortFeatureRepository: ResortFeatureRepository,
    ) { }

    async create(resortId: string, createReservationDto: CreateReservationDto): Promise<Reservation> {
        const { featureId, ...rest } = createReservationDto;
        const feature = await this.ensureFeatureBelongsToResort(resortId, featureId);

        const reservation = this.reservationRepository.create({
            ...rest,
            feature,
        });
        return this.reservationRepository.save(reservation);
    }

    findAll(resortId: string): Promise<Reservation[]> {
        return this.reservationRepository.find({
            where: { feature: { resort: { id: resortId } } },
            relations: { feature: true },
        });
    }

    async findOne(resortId: string, id: string): Promise<Reservation> {
        const reservation = await this.reservationRepository.findOne({
            where: { id, feature: { resort: { id: resortId } } },
            relations: { feature: true },
        });
        if (!reservation) {
            throw new NotFoundException(`Reservation with id ${id} not found for resort ${resortId}`);
        }
        return reservation;
    }

    async update(resortId: string, id: string, updateReservationDto: UpdateReservationDto): Promise<Reservation> {
        const reservation = await this.findOne(resortId, id);
        const { featureId, ...rest } = updateReservationDto;
        Object.assign(reservation, rest);
        if (featureId) {
            reservation.feature = await this.ensureFeatureBelongsToResort(resortId, featureId);
        }
        return this.reservationRepository.save(reservation);
    }

    async remove(resortId: string, id: string): Promise<void> {
        const reservation = await this.findOne(resortId, id);
        await this.reservationRepository.remove(reservation);
    }

    async getAvailability(resortId: string, featureId: string): Promise<number> {
        const feature = await this.ensureFeatureBelongsToResort(resortId, featureId);
        const activeCount = await this.reservationRepository.countActiveForFeature(featureId);
        return Math.max(feature.quantity - activeCount, 0);
    }

    private async ensureFeatureBelongsToResort(resortId: string, featureId: string): Promise<ResortFeature> {
        const feature = await this.resortFeatureRepository.findOne({
            where: { id: featureId, resort: { id: resortId } },
        });
        if (!feature) {
            throw new NotFoundException(`Feature with id ${featureId} not found for resort ${resortId}`);
        }
        return feature;
    }
}
