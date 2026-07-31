import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ResortFeature } from './resort-feature.entity';

export enum ReservationStatus {
  PENDING = 'Pending',
  ACCEPTED = 'Accepted',
  DECLINED = 'Declined',
  PROGRESS = 'Progress',
  FINISHED = 'Finished',
}

// Pending is a not-yet-committed request — it does not occupy a unit. Only a
// real commitment (staff-accepted, or an OTA booking which arrives already
// accepted) blocks availability locally or gets reported to Channex.
export const ACTIVE_RESERVATION_STATUSES = [
  ReservationStatus.ACCEPTED,
  ReservationStatus.PROGRESS,
];

export const ALLOWED_RESERVATION_STATUS_TRANSITIONS: Record<
  ReservationStatus,
  ReservationStatus[]
> = {
  [ReservationStatus.PENDING]: [
    ReservationStatus.ACCEPTED,
    ReservationStatus.DECLINED,
  ],
  // Staff can back out of an already-accepted reservation — e.g. an OTA
  // booking collided with it and they noticed on the reservation calendar.
  [ReservationStatus.ACCEPTED]: [
    ReservationStatus.PROGRESS,
    ReservationStatus.DECLINED,
  ],
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

  @Column({
    type: 'enum',
    enum: ReservationStatus,
    default: ReservationStatus.PENDING,
  })
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

  @Column({
    type: 'enum',
    enum: ReservationSource,
    default: ReservationSource.MANUAL,
  })
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

  // Not persisted (no @Column) — deliberately computed fresh on every read
  // from feature.quantity + currently-overlapping occupying reservations,
  // same principle as availability itself. A stored flag would drift from
  // reality the moment staff resolves the conflict; this can't.
  isOverbooked?: boolean;
}
