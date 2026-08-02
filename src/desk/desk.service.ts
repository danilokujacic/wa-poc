import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { ConversationRepository } from '../repository/conversation.repository';
import { MessageRepository } from '../repository/message.repository';
import { ResortRepository } from '../repository/resort.repository';
import {
  Conversation,
  ConversationStatus,
} from '../entity/conversation.entity';
import {
  Message,
  MessageDeliveryStatus,
  MessageSenderType,
} from '../entity/message.entity';
import { DeskGateway } from './desk.gateway';
import { DESK_EVENTS } from './desk.events';
import type {
  AiRepliedEvent,
  MessageReceivedEvent,
  ReservationStatusMessageEvent,
} from './desk.events';
import { REDIS_CLIENT } from '../redis/redis.provider';
import { DeskMessageProducer } from '../bullmq/desk-messages/desk-messages.producer';
import { WaSendProducer } from '../bullmq/wa-send/wa-send.producer';

export interface RecordMessageParams {
  resortId: string;
  guestPhoneNumber: string;
  sender: MessageSenderType;
  body: string;
  /** ISO 8601 — when the message was actually sent, not when we got around to processing it. */
  sentAt: string;
  sentByUserId?: string;
  /** Required for sender !== GUEST — the resort's WhatsApp phone number id to send from.
   * Guest messages never need this; they were already sent to us, not by us. */
  phoneNumberId?: string;
  /** Correlation id for this message's originating flow (see desk.events.ts for how each
   * flow picks one). Optional only because a couple of internal call sites don't have an
   * upstream flow to inherit one from — recordMessage falls back to the new Message's own id. */
  traceId?: string;
}

// How long an Idempotency-Key claim (and its mapping to the message it created) is remembered —
// long enough to cover a client retrying after a network blip well after the fact, short enough
// that the key space doesn't grow unbounded in Redis.
const IDEMPOTENCY_KEY_TTL_SECONDS = 24 * 3600;

@Injectable()
export class DeskService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly messageRepository: MessageRepository,
    private readonly resortRepository: ResortRepository,
    private readonly deskGateway: DeskGateway,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectPinoLogger(DeskService.name) private readonly logger: PinoLogger,
    private readonly deskMessageProducer: DeskMessageProducer,
    private readonly waSendProducer: WaSendProducer,
  ) {}

  async recordMessage(params: RecordMessageParams): Promise<Message> {
    let conversation = await this.conversationRepository.findOrCreate(
      params.resortId,
      params.guestPhoneNumber,
    );
    // Falls back to the Message's own id below once it exists — every message needs *some*
    // trace id, even the couple of call sites (retry, direct employee reply without one) that
    // don't inherit one from an upstream event.
    const traceId = params.traceId;

    if (
      params.sender === MessageSenderType.GUEST &&
      conversation.status === ConversationStatus.CLOSED
    ) {
      conversation.status = ConversationStatus.BOT;
      conversation = await this.conversationRepository.save(conversation);
    }

    const sentAt = new Date(params.sentAt);
    const isOutOfOrder = await this.checkAndUpdateOrdering(
      conversation.id,
      sentAt,
    );

    // Fire-and-forget: best-effort freshness for the conversation list, not a
    // correctness-critical field. Not worth blocking or guarding against out-of-order writes.
    this.conversationRepository
      .updateLastMessageSentAt(conversation.id, sentAt)
      .catch((error) => {
        this.logger.warn(
          { traceId, conversationId: conversation.id },
          `Failed to update lastMessageSentAt: ${error}`,
        );
      });

    // Guests never have a "delivery" to track — they're the ones who sent it to us.
    const deliveryStatus =
      params.sender === MessageSenderType.GUEST
        ? null
        : MessageDeliveryStatus.PENDING;

    // Intentionally never logging `body` here or anywhere else in this method — message
    // content (guest, AI, or employee) must not reach the log pipeline / Grafana.
    const message = await this.messageRepository.save(
      this.messageRepository.create({
        conversation,
        sender: params.sender,
        body: params.body,
        sentAt,
        deliveryStatus,
        sentByUser: params.sentByUserId ? { id: params.sentByUserId } : null,
      }),
    );

    // The pivot log line of the whole pipeline: ties the flow's originating traceId to the
    // Message row it produced. Every log downstream of this point (delivery, retries) keys
    // off `message.id` — this line is what lets you follow a trace from genesis to delivery.
    this.logger.info(
      {
        traceId: traceId ?? message.id,
        messageId: message.id,
        conversationId: conversation.id,
        resortId: params.resortId,
        sender: params.sender,
        deliveryStatus,
      },
      'Message recorded',
    );

    if (isOutOfOrder) {
      // Still persisted above — never dropped. Just skipped from the live feed so it
      // doesn't appear to jump backwards for anyone watching; it'll show up correctly
      // ordered (by sentAt, not arrival order) the next time the conversation is loaded.
      this.logger.warn(
        {
          traceId: traceId ?? message.id,
          messageId: message.id,
          conversationId: conversation.id,
        },
        `Skipping live broadcast for out-of-order message (sentAt ${sentAt.toISOString()})`,
      );
    } else {
      this.deskGateway.emitNewMessage(params.resortId, {
        conversationId: conversation.id,
        messageId: message.id,
        sender: message.sender,
        body: message.body,
        sentAt: message.sentAt,
        deliveryStatus: message.deliveryStatus,
        conversationStatus: conversation.status,
      });
    }

    if (
      deliveryStatus === MessageDeliveryStatus.PENDING &&
      params.phoneNumberId
    ) {
      // Not awaited-to-throw: the row above is already committed, so a failure here must
      // never bubble up and cause a caller (e.g. the durable DeskMessageProcessor) to retry
      // this whole method — that would create a second, duplicate message row. Worst case
      // on a failure here, the message is stuck at "Pending" forever, which is a much
      // smaller problem than a duplicate.
      try {
        await this.waSendProducer.enqueue({
          messageId: message.id,
          resortId: params.resortId,
          conversationId: conversation.id,
          phoneNumberId: params.phoneNumberId,
          guestPhoneNumber: params.guestPhoneNumber,
          text: params.body,
          traceId: traceId ?? message.id,
        });
      } catch (error) {
        this.logger.error(
          { traceId: traceId ?? message.id, messageId: message.id },
          `Failed to enqueue WhatsApp delivery; it will remain "Pending": ${error}`,
        );
      }
    }

    return message;
  }

  /**
   * Compares this message's sentAt against the latest one we've seen so far for the
   * conversation (tracked in Redis, no TTL — must survive restarts and dormant conversations).
   * Returns true if this message is older than what's already been shown, i.e. out of order.
   */
  private async checkAndUpdateOrdering(
    conversationId: string,
    sentAt: Date,
  ): Promise<boolean> {
    const key = this.latestSentKey(conversationId);
    const sentAtMs = sentAt.getTime();
    const cached = await this.redis.get(key);

    if (cached && Number(cached) > sentAtMs) {
      return true;
    }

    await this.redis.set(key, String(sentAtMs));
    return false;
  }

  private latestSentKey(conversationId: string): string {
    return `desk:latest-sent:${conversationId}`;
  }

  isHumanHandled(resortId: string, guestPhoneNumber: string): Promise<boolean> {
    return this.conversationRepository.isHumanHandled(
      resortId,
      guestPhoneNumber,
    );
  }

  // Guest/AI messages have no synchronous caller to retry on failure (the webhook already
  // ACK'd, the AI-flush job already swallows its own errors) — so recording them goes
  // through a durable queue instead of writing to the DB directly here. See
  // DeskMessageProcessor for the actual persist-then-broadcast (via recordMessage).
  @OnEvent(DESK_EVENTS.MESSAGE_RECEIVED)
  handleMessageReceived(event: MessageReceivedEvent): Promise<void> {
    return this.deskMessageProducer.enqueue({
      resortId: event.resortId,
      guestPhoneNumber: event.guestPhoneNumber,
      sender: MessageSenderType.GUEST,
      body: event.body,
      sentAt: event.sentAt,
      traceId: event.traceId,
    });
  }

  @OnEvent(DESK_EVENTS.AI_REPLIED)
  handleAiReplied(event: AiRepliedEvent): Promise<void> {
    return this.deskMessageProducer.enqueue({
      resortId: event.resortId,
      guestPhoneNumber: event.guestPhoneNumber,
      sender: MessageSenderType.AI,
      body: event.body,
      sentAt: event.sentAt,
      phoneNumberId: event.phoneNumberId,
      traceId: event.traceId,
    });
  }

  // Unlike AiRepliedEvent, this event doesn't carry phoneNumberId — the reservation
  // flow that emits it has no resort object in scope, only a resortId — so it's
  // resolved here, same as replyAsEmployee does below.
  @OnEvent(DESK_EVENTS.RESERVATION_STATUS_MESSAGE)
  async handleReservationStatusMessage(
    event: ReservationStatusMessageEvent,
  ): Promise<void> {
    const resort = await this.resortRepository.findOneBy({
      id: event.resortId,
    });
    if (!resort) {
      this.logger.warn(
        { traceId: event.traceId, resortId: event.resortId },
        'Reservation status message dropped: resort not found',
      );
      return;
    }

    await this.deskMessageProducer.enqueue({
      resortId: event.resortId,
      guestPhoneNumber: event.guestPhoneNumber,
      sender: MessageSenderType.EMPLOYEE,
      body: event.body,
      sentAt: event.sentAt,
      phoneNumberId: resort.phoneNumber,
      traceId: event.traceId,
    });
  }

  async claim(
    resortId: string,
    conversationId: string,
    userId: string,
  ): Promise<Conversation> {
    const conversation = await this.findConversationOrThrow(
      resortId,
      conversationId,
    );
    conversation.status = ConversationStatus.HUMAN;
    conversation.assignedUser = { id: userId } as Conversation['assignedUser'];
    return this.conversationRepository.save(conversation);
  }

  async close(resortId: string, conversationId: string): Promise<Conversation> {
    const conversation = await this.findConversationOrThrow(
      resortId,
      conversationId,
    );
    conversation.status = ConversationStatus.CLOSED;
    return this.conversationRepository.save(conversation);
  }

  async replyAsEmployee(
    resortId: string,
    conversationId: string,
    userId: string,
    body: string,
    idempotencyKey?: string,
  ): Promise<Message> {
    const conversation = await this.findConversationOrThrow(
      resortId,
      conversationId,
    );

    const resort = await this.resortRepository.findOneBy({ id: resortId });
    if (!resort) {
      throw new NotFoundException(`Resort with id ${resortId} not found`);
    }

    if (idempotencyKey) {
      const existing = await this.claimIdempotencyKey(
        conversationId,
        idempotencyKey,
      );
      if (existing) {
        return existing;
      }
    }

    // Fresh correlation id for this compose action — independent of the (optional)
    // idempotency key, which serves a different purpose (deduping retried requests).
    const traceId = randomUUID();
    this.logger.info(
      { traceId, conversationId, resortId, userId },
      'Employee reply requested',
    );
    try {
      // Persisted immediately as "Pending"; the actual WhatsApp send happens durably via
      // WaSendProducer inside recordMessage, so a broken/expired token doesn't block this
      // request or leave the reply unrecorded — see WA_SEND_QUEUE.
      const message = await this.recordMessage({
        resortId,
        guestPhoneNumber: conversation.guestPhoneNumber,
        sender: MessageSenderType.EMPLOYEE,
        body,
        phoneNumberId: resort.phoneNumber,
        sentAt: new Date().toISOString(),
        sentByUserId: userId,
        traceId,
      });

      if (idempotencyKey) {
        await this.redis.set(
          this.idempotencyRedisKey(conversationId, idempotencyKey),
          message.id,
          'EX',
          IDEMPOTENCY_KEY_TTL_SECONDS,
        );
      }

      return message;
    } catch (error) {
      if (idempotencyKey) {
        // The reply was never actually recorded — release the claim so a genuine retry
        // (after whatever failed) isn't blocked for the rest of the TTL window.
        await this.redis.del(
          this.idempotencyRedisKey(conversationId, idempotencyKey),
        );
      }
      throw error;
    }
  }

  /**
   * Compare-and-swap on the idempotency key: the first caller to use a given key claims it
   * (via Redis SET...NX) and proceeds to actually create the message; any concurrent or later
   * caller reusing the same key gets back the message the first caller created instead of
   * sending a duplicate. Returns null if this call is the one that claimed the key (caller
   * should proceed to create the message); returns the existing Message if it was already used.
   */
  private async claimIdempotencyKey(
    conversationId: string,
    idempotencyKey: string,
  ): Promise<Message | null> {
    const key = this.idempotencyRedisKey(conversationId, idempotencyKey);
    const claimed = await this.redis.set(
      key,
      'pending',
      'EX',
      IDEMPOTENCY_KEY_TTL_SECONDS,
      'NX',
    );
    if (claimed) {
      return null;
    }

    const stored = await this.redis.get(key);
    if (stored && stored !== 'pending') {
      const existing = await this.messageRepository.findOneForConversation(
        conversationId,
        stored,
      );
      if (existing) {
        this.logger.info(
          { traceId: existing.id, conversationId, messageId: existing.id },
          'Duplicate reply suppressed via idempotency key',
        );
        return existing;
      }
    }

    // Either another request with the same key is still mid-flight ("pending"), or it
    // claimed the key but the message it pointed to is somehow gone — either way, refuse
    // rather than risk creating a second real WhatsApp send under the same key.
    throw new ConflictException(
      'A reply with this idempotency key is already being processed.',
    );
  }

  private idempotencyRedisKey(
    conversationId: string,
    idempotencyKey: string,
  ): string {
    return `desk:idempotency:${conversationId}:${idempotencyKey}`;
  }

  /**
   * Manually re-attempts delivery of a message that permanently failed (WA_SEND_QUEUE
   * exhausted its ~3h of automatic retries). Reuses the message's existing id, body, and
   * sentAt untouched — this redelivers the exact same message, it does not create a new one.
   * Only "Failed" messages are eligible: a "Pending" one is already being retried
   * automatically, and retrying it manually risks sending it to the guest twice.
   */
  async retryMessageDelivery(
    resortId: string,
    conversationId: string,
    messageId: string,
  ): Promise<Message> {
    // No need to invent a new correlation id here — this is a continuation of an existing
    // message's story, so its own id is already the right anchor to trace by.
    const traceId = messageId;
    this.logger.info(
      { traceId, conversationId, resortId },
      'Manual delivery retry requested',
    );

    await this.findConversationOrThrow(resortId, conversationId);

    const message = await this.messageRepository.findOneForConversation(
      conversationId,
      messageId,
    );
    if (!message) {
      throw new NotFoundException(
        `Message with id ${messageId} not found in conversation ${conversationId}`,
      );
    }

    if (message.sender === MessageSenderType.GUEST) {
      throw new BadRequestException(
        'Guest messages were never sent by us — there is nothing to retry.',
      );
    }

    if (message.deliveryStatus !== MessageDeliveryStatus.FAILED) {
      throw new BadRequestException(
        `Message is not eligible for retry (current status: ${message.deliveryStatus ?? 'unknown'}). Only a permanently "Failed" message can be retried.`,
      );
    }

    const resort = await this.resortRepository.findOneBy({ id: resortId });
    if (!resort) {
      throw new NotFoundException(`Resort with id ${resortId} not found`);
    }

    // Atomic compare-and-swap: only flips to Pending if it's still Failed in the DB right
    // now. Without this, two concurrent retry calls (double-click, two employees) could both
    // pass the check above before either writes, and both enqueue a duplicate WhatsApp send.
    // The DB row is the only thing that can arbitrate that race, not the in-memory read above.
    const claim = await this.messageRepository.update(
      { id: messageId, deliveryStatus: MessageDeliveryStatus.FAILED },
      { deliveryStatus: MessageDeliveryStatus.PENDING },
    );
    if (claim.affected === 0) {
      this.logger.info(
        { traceId, conversationId },
        'Retry rejected — message is no longer eligible (lost the claim or not Failed)',
      );
      throw new BadRequestException(
        'Message is no longer eligible for retry — it may already be retrying.',
      );
    }

    this.deskGateway.emitMessageStatusUpdated(resortId, {
      conversationId,
      messageId: message.id,
      deliveryStatus: MessageDeliveryStatus.PENDING,
    });

    try {
      await this.waSendProducer.enqueue({
        messageId: message.id,
        resortId,
        conversationId,
        phoneNumberId: resort.phoneNumber,
        guestPhoneNumber: message.conversation.guestPhoneNumber,
        text: message.body,
        traceId,
      });
    } catch (error) {
      // The claim above already flipped the row to Pending — revert it so the message
      // doesn't sit stuck forever with nothing actually queued; the employee can retry again.
      this.logger.error(
        { traceId, conversationId },
        `Retry enqueue failed, reverting claim to Failed: ${error}`,
      );
      await this.messageRepository.update(messageId, {
        deliveryStatus: MessageDeliveryStatus.FAILED,
      });
      this.deskGateway.emitMessageStatusUpdated(resortId, {
        conversationId,
        messageId: message.id,
        deliveryStatus: MessageDeliveryStatus.FAILED,
      });
      throw error;
    }

    message.deliveryStatus = MessageDeliveryStatus.PENDING;
    return message;
  }

  findAllConversations(resortId: string): Promise<Conversation[]> {
    return this.conversationRepository.findAllForResort(resortId);
  }

  async findMessages(
    resortId: string,
    conversationId: string,
  ): Promise<Message[]> {
    await this.findConversationOrThrow(resortId, conversationId);
    return this.messageRepository.findAllForConversation(conversationId);
  }

  private async findConversationOrThrow(
    resortId: string,
    conversationId: string,
  ): Promise<Conversation> {
    const conversation = await this.conversationRepository.findForResort(
      resortId,
      conversationId,
    );
    if (!conversation) {
      throw new NotFoundException(
        `Conversation with id ${conversationId} not found for resort ${resortId}`,
      );
    }
    return conversation;
  }
}
