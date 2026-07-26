import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WebhookSignatureGuard } from './guards/webhook-signature.guard';
import { GlobalWebhookThrottlerGuard } from './guards/global-webhook-throttler.guard';
import { WebhookAckResponseDto } from './dto/webhook-ack-response.dto';

@Controller('whatsapp')
export class WhatsappController {
    constructor(private readonly whatsappService: WhatsappService) { }

    /**
     * WhatsApp Webhook callback: Important for verifying the webhook and receiving messages.
     * @param mode
     * @param challenge
     * @param verifyToken
     * @returns
     */
    @Get()
    callback(
        @Query("hub.challenge") challenge: string,
        @Query("hub.verify_token") verifyToken: string
    ) {
        return this.whatsappService.verifyTokenAndReturnChallenge(verifyToken, challenge);
    }

    // Guard order matters: verify the request actually came from Meta *before*
    // it can consume any of the shared rate-limit budget, so forged traffic
    // can't be used to exhaust the quota for legitimate messages.
    @Post()
    @UseGuards(WebhookSignatureGuard, GlobalWebhookThrottlerGuard)
    @HttpCode(200)
    handleWebhook(@Body() body: any) {
        this.whatsappService.processIncoming(body).catch((err) => {
            console.error('Error processing webhook event:', err);
        });
        return WebhookAckResponseDto.create();
    }


}
