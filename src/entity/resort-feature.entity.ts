import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Resort } from './resort.entity';

@Entity()
export class ResortFeature {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'float' })
  price: number;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'int' })
  capacity: number;

  @Column('text', { array: true, nullable: true })
  images: string[];

  @Column({ default: true })
  isActive: boolean;

  // Channex room_type UUID this feature is mapped to.
  @Column({ type: 'varchar', nullable: true, unique: true })
  channexRoomTypeId: string | null;

  // Channex rate_plan UUID this feature's price is mapped to.
  @Column({ type: 'varchar', nullable: true, unique: true })
  channexRatePlanId: string | null;

  @ManyToOne(() => Resort, (resort) => resort.features)
  resort: Resort;
}
