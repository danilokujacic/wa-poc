import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { Resort } from './resort.entity';
import { User } from './user.entity';

export enum ConversationStatus {
    BOT = 'Bot',
    HUMAN = 'Human',
    CLOSED = 'Closed',
}

@Entity()
@Unique(['resort', 'guestPhoneNumber'])
export class Conversation {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Resort)
    resort: Resort;

    @Column()
    guestPhoneNumber: string;

    @Column({ type: 'enum', enum: ConversationStatus, default: ConversationStatus.BOT })
    status: ConversationStatus;

    @ManyToOne(() => User, { nullable: true })
    assignedUser: User | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
