import { Injectable, Logger } from '@nestjs/common';
import { MessageBatchProducer } from 'src/bullmq/messages/messages.producer';

const GRAPH_API = 'https://graph.facebook.com/v21.0';

@Injectable()
export class WhatsappService {

    constructor(private readonly producer: MessageBatchProducer, private logger: Logger) { }

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
        this.logger.log(`Message from ${guestName} (${guestNumber}): ${guestText}`);

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
