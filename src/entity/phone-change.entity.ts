import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Resort } from './resort.entity';

@Entity()
export class PhoneChange {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Resort)
  resort: Resort;

  @Column()
  oldPhoneNumber: string;

  @Column()
  newPhoneNumber: string;

  @CreateDateColumn()
  createdAt: Date;
}
