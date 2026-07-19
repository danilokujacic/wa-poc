import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Resort } from './resort.entity';

export enum ContactType {
    PHONE = 'Phone',
    EMAIL = 'Email',
}

@Entity()
export class ResortContact {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    contact_name: string;

    @Column({ type: 'enum', enum: ContactType })
    type: ContactType;

    @Column()
    contact: string;

    @ManyToOne(() => Resort, (resort) => resort.contacts)
    resort: Resort;
}
