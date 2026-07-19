import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Faq } from './faq.entity';
import { User } from './user.entity';
import { ResortFeature } from './resort-feature.entity';
import { ResortContact } from './resort-contact.entity';

@Entity()
export class Resort {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column({ unique: true })
    phoneNumber: string;

    @Column({ nullable: true })
    address: string;

    @Column({ type: 'float', nullable: true })
    latitude: number;

    @Column({ type: 'float', nullable: true })
    longitude: number;

    @Column({ nullable: true })
    startWorkingHours: string;

    @Column({ nullable: true })
    endWorkingHours: string;

    @Column({ nullable: true })
    website: string;

    @OneToMany(() => Faq, (faq) => faq.resort)
    faqs: Faq[];

    @OneToMany(() => User, (user) => user.resort)
    users: User[];

    @OneToMany(() => ResortFeature, (feature) => feature.resort)
    features: ResortFeature[];

    @OneToMany(() => ResortContact, (contact) => contact.resort)
    contacts: ResortContact[];
}
