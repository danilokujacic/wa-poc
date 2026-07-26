import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { Message, MessageSenderType } from '../../entity/message.entity';

export class MessageResponseDto {
    @ApiProperty()
    @Expose()
    id: string;

    @ApiProperty()
    @Expose()
    conversationId: string;

    @ApiProperty({ enum: MessageSenderType })
    @Expose()
    sender: MessageSenderType;

    @ApiProperty()
    @Expose()
    body: string;

    @ApiProperty({ nullable: true })
    @Expose()
    sentByUserId: string | null;

    @ApiProperty()
    @Expose()
    createdAt: Date;

    static fromEntity(message: Message): MessageResponseDto {
        const dto = new MessageResponseDto();
        dto.id = message.id;
        dto.conversationId = message.conversation.id;
        dto.sender = message.sender;
        dto.body = message.body;
        dto.sentByUserId = message.sentByUser?.id ?? null;
        dto.createdAt = message.createdAt;
        return dto;
    }
}
