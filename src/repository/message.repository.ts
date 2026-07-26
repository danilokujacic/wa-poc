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
            order: { createdAt: 'ASC' },
        });
    }
}
