import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/**
 * Channex webhooks carry no signature (unlike WhatsApp's HMAC header) — the
 * only available control is a shared secret embedded in the callback URL
 * registered via POST /webhooks (e.g. https://you/channex/webhook?token=...).
 */
@Injectable()
export class ChannexWebhookGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    if (process.env.NODE_ENV !== 'production') {
      return true;
    }

    const token = this.configService.get<string>('CHANNEX_WEBHOOK_TOKEN');
    if (!token) {
      throw new UnauthorizedException(
        'Channex webhook token is not configured',
      );
    }

    const request = context.switchToHttp().getRequest<Request>();
    if (request.query.token !== token) {
      throw new UnauthorizedException('Invalid Channex webhook token');
    }

    return true;
  }
}
