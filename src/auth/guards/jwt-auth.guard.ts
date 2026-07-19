import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { JwtPayload } from '../jwt-payload.interface';
import { ACCESS_TOKEN_COOKIE } from '../auth.constants';

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(private readonly jwtService: JwtService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request & { user: JwtPayload }>();
        const token = this.extractToken(request);
        if (!token) {
            throw new UnauthorizedException('Missing auth token');
        }

        try {
            request.user = await this.jwtService.verifyAsync<JwtPayload>(token);
        } catch {
            throw new UnauthorizedException('Invalid or expired token');
        }

        return true;
    }

    private extractToken(request: Request): string | undefined {
        const cookieToken = (request.cookies as Record<string, string> | undefined)?.[ACCESS_TOKEN_COOKIE];
        if (cookieToken) {
            return cookieToken;
        }

        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        return type === 'Bearer' ? token : undefined;
    }
}
