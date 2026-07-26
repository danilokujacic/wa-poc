import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ReservationRepository } from '../repository/reservation.repository';
import { ResortFeatureRepository } from '../repository/resort-feature.repository';
import { ALLOWED_RESERVATION_STATUS_TRANSITIONS, Reservation, ReservationStatus } from '../entity/reservation.entity';
import { ResortFeature } from '../entity/resort-feature.entity';
import { FindOperator, FindOptionsWhere, ILike, LessThanOrEqual, MoreThanOrEqual } from "typeorm";
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { FindReservationsQueryDto } from './dto/find-reservations-query.dto';

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

    private parseDate(date: string): Date {
        return new Date(date);
    }

    findAll(resortId: string, { from = new Date().toString(), to, status = 'ALL', phoneNumber = '' }: FindReservationsQueryDto): Promise<Reservation[]> {
        const fromISO = this.parseDate(from);
        const toISO = to ? this.parseDate(to) : undefined;
        const query: FindOptionsWhere<Reservation> = {
            feature: { resort: { id: resortId } },
            startDate: MoreThanOrEqual(fromISO),
        }

        if (toISO) {
            query.endDate = LessThanOrEqual(toISO);
        }

        if (status && status !== 'ALL') {
            query.status = status;
        }

        if (phoneNumber) {
            query.phoneNumber = ILike(`%${phoneNumber}%`);
        }

        return this.reservationRepository.find({
            where: query,
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

    async updateStatus(resortId: string, id: string, status: ReservationStatus): Promise<Reservation> {
        const reservation = await this.findOne(resortId, id);

        const allowedNextStatuses = ALLOWED_RESERVATION_STATUS_TRANSITIONS[reservation.status];
        if (!allowedNextStatuses.includes(status)) {
            throw new BadRequestException(`Cannot change reservation status from ${reservation.status} to ${status}`);
        }

        reservation.status = status;
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

    async getAvailabilityForAllFeatures(resortId: string): Promise<Array<{ featureId: string; name: string; availability: number }>> {
        const features = await this.resortFeatureRepository.find({ where: { resort: { id: resortId }, isActive: true } });
        if (features.length === 0) {
            return [];
        }

        const activeCounts = await this.reservationRepository.countActiveForFeatures(features.map((feature) => feature.id));

        return features.map((feature) => ({
            featureId: feature.id,
            name: feature.name,
            availability: Math.max(feature.quantity - (activeCounts.get(feature.id) ?? 0), 0),
        }));
    }

    private async ensureFeatureBelongsToResort(resortId: string, featureId: string): Promise<ResortFeature> {
        const feature = await this.resortFeatureRepository.findOne({
            where: { id: featureId, resort: { id: resortId } },
        });
        if (!feature) {
            throw new NotFoundException(`Feature with id ${featureId} not found for resort ${resortId}`);
        }
        if (!feature.isActive) {
            throw new BadRequestException(`Feature with id ${featureId} has been deleted and can no longer be used for reservations`);
        }
        return feature;
    }
}
