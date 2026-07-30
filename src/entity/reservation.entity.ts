import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ResortFeature } from './resort-feature.entity';

export enum ReservationStatus {
    PENDING = 'Pending',
    ACCEPTED = 'Accepted',
    DECLINED = 'Declined',
    PROGRESS = 'Progress',
    FINISHED = 'Finished',
}

export const ACTIVE_RESERVATION_STATUSES = [
    ReservationStatus.PENDING,
    ReservationStatus.ACCEPTED,
    ReservationStatus.PROGRESS,
];

export const ALLOWED_RESERVATION_STATUS_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
    [ReservationStatus.PENDING]: [ReservationStatus.ACCEPTED, ReservationStatus.DECLINED],
    [ReservationStatus.ACCEPTED]: [ReservationStatus.PROGRESS],
    [ReservationStatus.PROGRESS]: [ReservationStatus.FINISHED],
    [ReservationStatus.DECLINED]: [],
    [ReservationStatus.FINISHED]: [],
};

export enum ReservationSource {
    MANUAL = 'Manual',
    CHANNEX = 'Channex',
}

@Entity()
export class Reservation {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => ResortFeature)
    feature: ResortFeature;

    @Column({ type: 'enum', enum: ReservationStatus, default: ReservationStatus.PENDING })
    status: ReservationStatus;

    @Column({ type: 'date' })
    startDate: Date;

    @Column({ type: 'date' })
    endDate: Date;

    @Column()
    phoneNumber: string;

    @Column({ type: 'int' })
    adults: number;

    @Column({ type: 'int' })
    kids: number;

    @Column({ type: 'jsonb', nullable: true })
    otherContact: unknown;

    @Column({ type: 'enum', enum: ReservationSource, default: ReservationSource.MANUAL })
    source: ReservationSource;

    // Channex booking id (stable across revisions). Not DB-unique: a single OTA
    // booking that spans multiple room types is ingested as one reservation row
    // per room segment (see ChannexBookingSyncService), so several rows can share it.
    @Column({ type: 'varchar', nullable: true })
    channexBookingId: string | null;

    @Column({ type: 'varchar', nullable: true })
    otaName: string | null;

    @Column({ type: 'varchar', nullable: true })
    otaReservationCode: string | null;

    @CreateDateColumn()
    createdAt: Date;
}
