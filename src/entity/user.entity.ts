import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Resort } from './resort.entity';

export enum UserRole {
    OWNER = 'Owner',
    EMPLOYEE = 'Employee',
}

@Entity()
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column()
    password: string;

    @Column({ unique: true })
    email: string;

    @Column({ type: 'enum', enum: UserRole })
    role: UserRole;

    @Column({ default: false })
    emailConfirmed: boolean;

    @ManyToOne(() => Resort, (resort) => resort.users, { nullable: true })
    resort: Resort | null;
}
