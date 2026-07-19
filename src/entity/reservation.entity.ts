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

    @Column({ type: 'jsonb', nullable: true })
    otherContact: unknown;

    @CreateDateColumn()
    createdAt: Date;
}
