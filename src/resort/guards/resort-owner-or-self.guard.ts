import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '../../entity/user.entity';
import { JwtPayload } from '../../auth/jwt-payload.interface';

@Injectable()
export class ResortOwnerOrSelfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();
    const { user, params } = request;

    const isOwner =
      !!user &&
      user.role === UserRole.OWNER &&
      user.resortId === params.resortId;
    const isSelf = !!user && user.sub === params.userId;

    if (!isOwner && !isSelf) {
      throw new ForbiddenException(
        'Only the resort owner or the user themselves can remove this user',
      );
    }

    return true;
  }
}
