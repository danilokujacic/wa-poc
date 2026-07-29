import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { Conversation, ConversationStatus } from '../../entity/conversation.entity';

export class ConversationResponseDto {
    @ApiProperty()
    @Expose()
    id: string;

    @ApiProperty()
    @Expose()
    guestPhoneNumber: string;

    @ApiProperty({ enum: ConversationStatus })
    @Expose()
    status: ConversationStatus;

    @ApiProperty({ nullable: true })
    @Expose()
    assignedUserId: string | null;

    @ApiProperty()
    @Expose()
    lastMessageSentAt: Date;

    @ApiProperty()
    @Expose()
    createdAt: Date;

    @ApiProperty()
    @Expose()
    updatedAt: Date;

    static fromEntity(conversation: Conversation): ConversationResponseDto {
        const dto = new ConversationResponseDto();
        dto.id = conversation.id;
        dto.guestPhoneNumber = conversation.guestPhoneNumber;
        dto.status = conversation.status;
        dto.assignedUserId = conversation.assignedUser?.id ?? null;
        dto.lastMessageSentAt = conversation.lastMessageSentAt;
        dto.createdAt = conversation.createdAt;
        dto.updatedAt = conversation.updatedAt;
        return dto;
    }
}
