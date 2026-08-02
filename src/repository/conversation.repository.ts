import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import {
  Conversation,
  ConversationStatus,
} from '../entity/conversation.entity';

@Injectable()
export class ConversationRepository extends Repository<Conversation> {
  constructor(private readonly dataSource: DataSource) {
    super(Conversation, dataSource.createEntityManager());
  }

  async findOrCreate(
    resortId: string,
    guestPhoneNumber: string,
  ): Promise<Conversation> {
    const existing = await this.findOne({
      where: { resort: { id: resortId }, guestPhoneNumber },
    });
    if (existing) {
      return existing;
    }

    try {
      return await this.save(
        this.create({
          resort: { id: resortId } as Conversation['resort'],
          guestPhoneNumber,
        }),
      );
    } catch (error) {
      const existingAfterRace = await this.findOne({
        where: { resort: { id: resortId }, guestPhoneNumber },
      });
      if (existingAfterRace) {
        return existingAfterRace;
      }
      throw error;
    }
  }

  findAllForResort(resortId: string): Promise<Conversation[]> {
    return this.find({
      where: { resort: { id: resortId } },
      order: { updatedAt: 'DESC' },
    });
  }

  findForResort(resortId: string, id: string): Promise<Conversation | null> {
    return this.findOne({ where: { id, resort: { id: resortId } } });
  }

  async isHumanHandled(
    resortId: string,
    guestPhoneNumber: string,
  ): Promise<boolean> {
    const conversation = await this.findOne({
      where: { resort: { id: resortId }, guestPhoneNumber },
    });
    return conversation?.status === ConversationStatus.HUMAN;
  }

  async updateLastMessageSentAt(id: string, sentAt: Date): Promise<void> {
    await this.update(id, { lastMessageSentAt: sentAt });
  }
}
