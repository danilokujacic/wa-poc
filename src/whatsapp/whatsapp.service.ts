import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { MessageBatchProducer } from 'src/bullmq/messages/messages.producer';
import { ResortContextService } from 'src/resort/resort-context.service';
import { DESK_EVENTS } from 'src/desk/desk.events';
import type { MessageReceivedEvent } from 'src/desk/desk.events';

const GRAPH_API = 'https://graph.facebook.com/v21.0';

@Injectable()
export class WhatsappService {

    constructor(
        private readonly producer: MessageBatchProducer,
        private readonly resortContextService: ResortContextService,
        private readonly eventEmitter: EventEmitter2,
        @InjectPinoLogger(WhatsappService.name) private readonly logger: PinoLogger,
    ) { }

    verifyWebhookToken(token: string): boolean {
        return token === process.env.WHATSAPP_VERIFY_TOKEN;
    }

    verifyTokenAndReturnChallenge(token: string, challenge: string): string | null {
        if (this.verifyWebhookToken(token)) {
            return challenge;
        }
        return null;
    }

    async processIncoming(body: any): Promise<void> {
        const value = body?.entry?.[0]?.changes?.[0]?.value;
        if (!value) return;

        const message = value.messages?.[0];
        if (!message) return;

        const phoneNumberId = value.metadata?.phone_number_id;
        const guestNumber = message.from; // guest's WhatsApp number
        const guestName = value.contacts?.[0]?.profile?.name ?? 'Guest';

        // Only handle plain text for the POC. Extend with 'image', 'audio', etc. later.
        if (message.type !== 'text') {
            await this.sendText(
                '1211777188687734',
                '38269280401',
                "Sorry, I can only read text messages for now. How can I help you?",
            );
            return;
        }

        const guestText = message.text.body;
        this.logger.info(`Message from ${guestName} (${guestNumber}): ${guestText}`);

        await this.recordInboundMessageForDesk(`${phoneNumberId}:${guestNumber}`, phoneNumberId, guestNumber, guestText);

        try {
            await this.producer.addMessage(
                {
                    conversationKey: `${phoneNumberId}:${guestNumber}`,
                    phoneNumberId,
                    guestNumber,
                    guestName,
                },
                {
                    id: message.id,
                    text: message.text.body,
                    timestamp: Number(message.timestamp),
                },
            );
        } catch (error) {
            await this.sendText(
                '1211777188687734',
                '38269280401',
                "Sorry, I cannot process your message right now. Please try again later.",
            );
            this.logger.error(`Error adding message to queue: ${error}`);
        }
    }

    /**
     * Persists the raw guest message + broadcasts it to the desk immediately, decoupled from
     * the AI debounce/batch pipeline above — employees watching the desk shouldn't wait out the
     * debounce window to see what a guest actually typed. Never throws: a desk-recording failure
     * must never block the AI reply pipeline, which is a separate concern with its own retries.
     */
    private async recordInboundMessageForDesk(
        conversationKey: string,
        phoneNumberId: string,
        guestNumber: string,
        guestText: string,
    ): Promise<void> {
        try {
            const resort = await this.resortContextService.get(conversationKey, phoneNumberId);
            if (!resort) {
                return;
            }

            const event: MessageReceivedEvent = {
                resortId: resort.id,
                guestPhoneNumber: guestNumber,
                body: guestText,
            };
            this.eventEmitter.emit(DESK_EVENTS.MESSAGE_RECEIVED, event);
        } catch (error) {
            this.logger.error(`Error recording inbound message for desk: ${error}`);
        }
    }

    async sendText(
        phoneNumberId: string,
        to: string,
        text: string,
    ): Promise<void> {
        const res = await fetch(`${GRAPH_API}/${phoneNumberId}/messages`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to,
                type: 'text',
                text: { body: text },
            }),
        });



        if (!res.ok) {
            const err = await res.text();
            this.logger.error(`Failed to send message: ${res.status} ${err}`);
        }
    }

    private async markAsRead(
        phoneNumberId: string,
        messageId: string,
    ): Promise<void> {
        await fetch(`${GRAPH_API} / ${phoneNumberId}/messages`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                status: 'read',
                message_id: messageId,
            }),
        }).catch(() => {
            /* non-critical, ignore failures */
        });
    }
}
