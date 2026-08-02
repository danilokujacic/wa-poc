import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ResortMemberGuard } from '../resort/guards/resort-member.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { DeskService } from './desk.service';
import { DeskThrottlerGuard } from './guards/desk-throttler.guard';
import { CreateEmployeeReplyDto } from './dto/create-employee-reply.dto';
import { ConversationResponseDto } from './dto/conversation-response.dto';
import { MessageResponseDto } from './dto/message-response.dto';

const IDEMPOTENCY_KEY_MAX_LENGTH = 200;

@ApiTags('desk')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ResortMemberGuard, DeskThrottlerGuard)
// Per-user budget: generous enough for a busy employee's normal cadence, tight enough to cap
// a leaked/compromised session (or a buggy client loop) from hammering these endpoints — each
// call has real downstream cost (a DB write, a queue job, a real WhatsApp API send).
@Throttle({
  default: {
    limit: Number(process.env.DESK_RATE_LIMIT_MAX ?? 60),
    ttl: Number(process.env.DESK_RATE_LIMIT_WINDOW_MS ?? 60_000),
  },
})
@Controller('resort/:resortId/desk')
export class DeskController {
  constructor(private readonly deskService: DeskService) {}

  @Get('conversations')
  @ApiOperation({
    summary:
      "List a resort's live conversations — its owner or employees may do this",
  })
  @ApiParam({ name: 'resortId', type: String })
  async findAllConversations(@Param('resortId') resortId: string) {
    const conversations = await this.deskService.findAllConversations(resortId);
    return conversations.map((conversation) =>
      ConversationResponseDto.fromEntity(conversation),
    );
  }

  @Get('conversations/:id/messages')
  @ApiOperation({
    summary:
      "Get a conversation's messages — its owner or employees may do this",
  })
  @ApiParam({ name: 'resortId', type: String })
  @ApiParam({ name: 'id', type: String })
  async findMessages(
    @Param('resortId') resortId: string,
    @Param('id') id: string,
  ) {
    const messages = await this.deskService.findMessages(resortId, id);
    return messages.map((message) => MessageResponseDto.fromEntity(message));
  }

  @Patch('conversations/:id/claim')
  @ApiOperation({
    summary:
      'Take over a conversation from the AI — its owner or employees may do this',
  })
  @ApiParam({ name: 'resortId', type: String })
  @ApiParam({ name: 'id', type: String })
  async claim(
    @Param('resortId') resortId: string,
    @Param('id') id: string,
    @Req() request: Request & { user: JwtPayload },
  ) {
    const conversation = await this.deskService.claim(
      resortId,
      id,
      request.user.sub,
    );
    return ConversationResponseDto.fromEntity(conversation);
  }

  @Patch('conversations/:id/close')
  @ApiOperation({
    summary: 'Close a conversation — its owner or employees may do this',
  })
  @ApiParam({ name: 'resortId', type: String })
  @ApiParam({ name: 'id', type: String })
  async close(@Param('resortId') resortId: string, @Param('id') id: string) {
    const conversation = await this.deskService.close(resortId, id);
    return ConversationResponseDto.fromEntity(conversation);
  }

  @Post('conversations/:id/messages')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  @ApiOperation({
    summary:
      'Send a reply to the guest as an employee — its owner or employees may do this',
  })
  @ApiParam({ name: 'resortId', type: String })
  @ApiParam({ name: 'id', type: String })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description:
      'Client-generated key (e.g. a UUID per compose action) to prevent a duplicate WhatsApp send if the request is retried after a network error.',
  })
  async reply(
    @Param('resortId') resortId: string,
    @Param('id') id: string,
    @Body() dto: CreateEmployeeReplyDto,
    @Req() request: Request & { user: JwtPayload },
    @Headers('Idempotency-Key') idempotencyKey?: string,
  ) {
    if (idempotencyKey && idempotencyKey.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
      throw new BadRequestException(
        `Idempotency-Key header must not exceed ${IDEMPOTENCY_KEY_MAX_LENGTH} characters.`,
      );
    }

    const message = await this.deskService.replyAsEmployee(
      resortId,
      id,
      request.user.sub,
      dto.body,
      idempotencyKey,
    );
    return MessageResponseDto.fromEntity(message);
  }

  @Post('conversations/:id/messages/:messageId/retry')
  @ApiOperation({
    summary:
      'Retry delivering a message that permanently failed to send — its owner or employees may do this',
  })
  @ApiParam({ name: 'resortId', type: String })
  @ApiParam({ name: 'id', type: String })
  @ApiParam({ name: 'messageId', type: String })
  async retryMessage(
    @Param('resortId') resortId: string,
    @Param('id') id: string,
    @Param('messageId') messageId: string,
  ) {
    const message = await this.deskService.retryMessageDelivery(
      resortId,
      id,
      messageId,
    );
    return MessageResponseDto.fromEntity(message);
  }
}
