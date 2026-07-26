import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
    OnGatewayConnection,
    OnGatewayDisconnect,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Server, Socket } from 'socket.io';
import { ACCESS_TOKEN_COOKIE } from '../auth/auth.constants';
import { JwtPayload } from '../auth/jwt-payload.interface';

@WebSocketGateway({
    namespace: 'desk',
    cors: {
        origin: true,
        credentials: true,
    },
})
export class DeskGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    constructor(
        private readonly jwtService: JwtService,
        @InjectPinoLogger(DeskGateway.name) private readonly logger: PinoLogger,
    ) { }

    async handleConnection(client: Socket): Promise<void> {
        try {
            const token = this.extractToken(client);
            if (!token) {
                throw new UnauthorizedException('Missing auth token');
            }

            const user = await this.jwtService.verifyAsync<JwtPayload>(token);
            if (!user.resortId) {
                throw new UnauthorizedException('User is not tied to a resort');
            }

            client.data.user = user;
            await client.join(this.resortRoom(user.resortId));
            this.logger.info(`Desk socket ${client.id} connected for resort ${user.resortId}`);
        } catch (error) {
            this.logger.warn(`Rejected desk socket connection ${client.id}: ${error}`);
            client.disconnect(true);
        }
    }

    handleDisconnect(client: Socket): void {
        this.logger.debug(`Desk socket ${client.id} disconnected`);
    }

    emitNewMessage(resortId: string, payload: unknown): void {
        this.server.to(this.resortRoom(resortId)).emit('newMessage', payload);
    }

    private resortRoom(resortId: string): string {
        return `resort:${resortId}`;
    }

    private extractToken(client: Socket): string | undefined {
        const authToken = client.handshake.auth?.token as string | undefined;
        if (authToken) {
            return authToken;
        }

        const [type, bearerToken] = (client.handshake.headers.authorization ?? '').split(' ');
        if (type === 'Bearer' && bearerToken) {
            return bearerToken;
        }

        return this.parseCookie(client.handshake.headers.cookie, ACCESS_TOKEN_COOKIE);
    }

    private parseCookie(cookieHeader: string | undefined, name: string): string | undefined {
        if (!cookieHeader) {
            return undefined;
        }

        for (const part of cookieHeader.split(';')) {
            const [key, ...rest] = part.trim().split('=');
            if (key === name) {
                return decodeURIComponent(rest.join('='));
            }
        }

        return undefined;
    }
}
