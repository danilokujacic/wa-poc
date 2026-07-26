import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Conversation } from './conversation.entity';
import { User } from './user.entity';

export enum MessageSenderType {
    GUEST = 'Guest',
    AI = 'Ai',
    EMPLOYEE = 'Employee',
}

@Entity()
export class Message {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Conversation)
    conversation: Conversation;

    @Column({ type: 'enum', enum: MessageSenderType })
    sender: MessageSenderType;

    @Column('text')
    body: string;

    @ManyToOne(() => User, { nullable: true })
    sentByUser: User | null;

    @CreateDateColumn()
    createdAt: Date;
}
