import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ResortMemberGuard } from '../resort/guards/resort-member.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { DeskService } from './desk.service';
import { CreateEmployeeReplyDto } from './dto/create-employee-reply.dto';
import { ConversationResponseDto } from './dto/conversation-response.dto';
import { MessageResponseDto } from './dto/message-response.dto';

@ApiTags('desk')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ResortMemberGuard)
@Controller('resort/:resortId/desk')
export class DeskController {
    constructor(private readonly deskService: DeskService) { }

    @Get('conversations')
    @ApiOperation({ summary: "List a resort's live conversations — its owner or employees may do this" })
    @ApiParam({ name: 'resortId', type: String })
    async findAllConversations(@Param('resortId') resortId: string) {
        const conversations = await this.deskService.findAllConversations(resortId);
        return conversations.map((conversation) => ConversationResponseDto.fromEntity(conversation));
    }

    @Get('conversations/:id/messages')
    @ApiOperation({ summary: "Get a conversation's messages — its owner or employees may do this" })
    @ApiParam({ name: 'resortId', type: String })
    @ApiParam({ name: 'id', type: String })
    async findMessages(@Param('resortId') resortId: string, @Param('id') id: string) {
        const messages = await this.deskService.findMessages(resortId, id);
        return messages.map((message) => MessageResponseDto.fromEntity(message));
    }

    @Patch('conversations/:id/claim')
    @ApiOperation({ summary: 'Take over a conversation from the AI — its owner or employees may do this' })
    @ApiParam({ name: 'resortId', type: String })
    @ApiParam({ name: 'id', type: String })
    async claim(
        @Param('resortId') resortId: string,
        @Param('id') id: string,
        @Req() request: Request & { user: JwtPayload },
    ) {
        const conversation = await this.deskService.claim(resortId, id, request.user.sub);
        return ConversationResponseDto.fromEntity(conversation);
    }

    @Patch('conversations/:id/close')
    @ApiOperation({ summary: 'Close a conversation — its owner or employees may do this' })
    @ApiParam({ name: 'resortId', type: String })
    @ApiParam({ name: 'id', type: String })
    async close(@Param('resortId') resortId: string, @Param('id') id: string) {
        const conversation = await this.deskService.close(resortId, id);
        return ConversationResponseDto.fromEntity(conversation);
    }

    @Post('conversations/:id/messages')
    @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
    @ApiOperation({ summary: 'Send a reply to the guest as an employee — its owner or employees may do this' })
    @ApiParam({ name: 'resortId', type: String })
    @ApiParam({ name: 'id', type: String })
    async reply(
        @Param('resortId') resortId: string,
        @Param('id') id: string,
        @Body() dto: CreateEmployeeReplyDto,
        @Req() request: Request & { user: JwtPayload },
    ) {
        const message = await this.deskService.replyAsEmployee(resortId, id, request.user.sub, dto.body);
        return MessageResponseDto.fromEntity(message);
    }
}
