import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Resort } from './resort.entity';

@Entity()
export class Faq {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    question: string;

    @Column()
    answer: string;

    @ManyToOne(() => Resort, (resort) => resort.faqs)
    resort: Resort;
}
