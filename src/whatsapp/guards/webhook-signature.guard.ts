import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class WebhookSignatureGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {

        if (process.env.NODE_ENV !== 'production') {
            // In development, we may not have the signature header or raw body available,
            // so we skip the verification to allow testing with tools like Postman.
            return true;
        }

        const request = context.switchToHttp().getRequest<Request & { rawBody?: Buffer }>();

        const appSecret = process.env.WHATSAPP_APP_SECRET;
        if (!appSecret) {
            throw new UnauthorizedException('Webhook signature verification is not configured');
        }

        const signatureHeader = request.headers['x-hub-signature-256'];
        if (typeof signatureHeader !== 'string' || !request.rawBody) {
            throw new UnauthorizedException('Missing webhook signature');
        }

        const expected = `sha256=${createHmac('sha256', appSecret).update(request.rawBody).digest('hex')}`;
        const expectedBuffer = Buffer.from(expected);
        const actualBuffer = Buffer.from(signatureHeader);

        if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
            throw new UnauthorizedException('Invalid webhook signature');
        }

        return true;
    }
}
