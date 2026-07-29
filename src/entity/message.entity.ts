import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Conversation } from './conversation.entity';
import { User } from './user.entity';

export enum MessageSenderType {
    GUEST = 'Guest',
    AI = 'Ai',
    EMPLOYEE = 'Employee',
}

export enum MessageDeliveryStatus {
    PENDING = 'Pending',
    SENT = 'Sent',
    FAILED = 'Failed',
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

    /** Null for GUEST messages — nothing is "sent" by us. For AI/EMPLOYEE messages, starts
     * PENDING at persist time and is flipped to SENT/FAILED once the durable WhatsApp send
     * (WaSendProcessor) resolves, independent of this row's own persistence. */
    @Column({ type: 'enum', enum: MessageDeliveryStatus, nullable: true })
    deliveryStatus: MessageDeliveryStatus | null;

    /** When the message was actually sent (WhatsApp's own timestamp for guest messages,
     * server time for AI/employee messages) — the ordering key. Not the same as `createdAt`,
     * which is just when our server got around to writing the row and can't be trusted for
     * ordering under out-of-order webhook delivery or concurrent processing. */
    @Column({ type: 'timestamptz' })
    sentAt: Date;

    @CreateDateColumn()
    createdAt: Date;
}
