import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '../../entity/user.entity';
import { JwtPayload } from '../../auth/jwt-payload.interface';

@Injectable()
export class ResortOwnerGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
        const { user, params } = request;

        if (!user || user.role !== UserRole.OWNER || user.resortId !== params.resortId) {
            throw new ForbiddenException('Only the resort owner can modify its users');
        }

        return true;
    }
}
