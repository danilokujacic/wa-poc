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

    @Column('text', { array: true, nullable: true })
    images: string[];

    @ManyToOne(() => Resort, (resort) => resort.features)
    resort: Resort;
}
