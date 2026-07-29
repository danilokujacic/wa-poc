import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Message } from '../entity/message.entity';

@Injectable()
export class MessageRepository extends Repository<Message> {
    constructor(private readonly dataSource: DataSource) {
        super(Message, dataSource.createEntityManager());
    }

    findAllForConversation(conversationId: string): Promise<Message[]> {
        return this.find({
            where: { conversation: { id: conversationId } },
            relations: { conversation: true },
            order: { sentAt: 'ASC' },
        });
    }

    findOneForConversation(conversationId: string, messageId: string): Promise<Message | null> {
        return this.findOne({
            where: { id: messageId, conversation: { id: conversationId } },
            relations: { conversation: true },
        });
    }
}
