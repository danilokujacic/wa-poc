import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { JwtPayload } from '../../auth/jwt-payload.interface';

@Injectable()
export class ResortMemberGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
        const { user, params } = request;

        if (!user || user.resortId !== params.resortId) {
            throw new ForbiddenException('You are not a member of this resort');
        }

        return true;
    }
}
