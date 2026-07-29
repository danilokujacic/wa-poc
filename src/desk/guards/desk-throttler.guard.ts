import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import type { JwtPayload } from '../../auth/jwt-payload.interface';

/**
 * Desk routes always run behind JwtAuthGuard first, so track quota per authenticated user
 * rather than per IP — several employees can share an office/VPN IP, which would let one
 * employee's traffic exhaust the budget for everyone else on that IP (or vice versa).
 */
@Injectable()
export class DeskThrottlerGuard extends ThrottlerGuard {
    protected async getTracker(req: Request & { user?: JwtPayload }): Promise<string> {
        return req.user?.sub ?? req.ip ?? 'unknown';
    }
}
