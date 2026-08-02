import { UnauthorizedException } from '@nestjs/common';
import { getLoggerToken } from 'nestjs-pino';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import type { Server, Socket } from 'socket.io';
import { DeskGateway } from './desk.gateway';

interface FakeSocket {
  id: string;
  data: Record<string, unknown>;
  handshake: {
    auth: Record<string, unknown>;
    headers: Record<string, string>;
  };
  join: jest.Mock;
  disconnect: jest.Mock;
}

function fakeSocket(
  overrides: {
    auth?: Record<string, unknown>;
    headers?: Record<string, string>;
  } = {},
): FakeSocket {
  return {
    id: 'socket-1',
    data: {},
    handshake: {
      auth: overrides.auth ?? {},
      headers: overrides.headers ?? {},
    },
    join: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
  };
}

describe('DeskGateway', () => {
  let gateway: DeskGateway;
  let jwtService: { verifyAsync: jest.Mock };
  let logger: {
    info: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
    debug: jest.Mock;
  };

  beforeEach(async () => {
    jwtService = { verifyAsync: jest.fn() };
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeskGateway,
        { provide: JwtService, useValue: jwtService },
        { provide: getLoggerToken(DeskGateway.name), useValue: logger },
      ],
    }).compile();

    gateway = module.get<DeskGateway>(DeskGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('joins the resort room using the token from handshake.auth.token', async () => {
      const client = fakeSocket({ auth: { token: 'auth-token' } });
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-1',
        resortId: 'resort-1',
      });

      await gateway.handleConnection(client as unknown as Socket);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith('auth-token');
      expect(client.join).toHaveBeenCalledWith('resort:resort-1');
      expect(client.data.user).toEqual({ sub: 'user-1', resortId: 'resort-1' });
      expect(logger.info).toHaveBeenCalledWith(
        'Desk socket socket-1 connected for resort resort-1',
      );
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('falls back to the Authorization Bearer header when auth.token is absent', async () => {
      const client = fakeSocket({
        headers: { authorization: 'Bearer bearer-token' },
      });
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-1',
        resortId: 'resort-1',
      });

      await gateway.handleConnection(client as unknown as Socket);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith('bearer-token');
      expect(client.join).toHaveBeenCalledWith('resort:resort-1');
    });

    it('ignores an Authorization header that is not a Bearer scheme', async () => {
      const client = fakeSocket({
        headers: { authorization: 'Basic something' },
      });

      await gateway.handleConnection(client as unknown as Socket);

      expect(jwtService.verifyAsync).not.toHaveBeenCalled();
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('falls back to the access_token cookie when no auth token or Bearer header is present', async () => {
      const client = fakeSocket({
        headers: { cookie: 'other=1; access_token=cookie-token; another=2' },
      });
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-1',
        resortId: 'resort-1',
      });

      await gateway.handleConnection(client as unknown as Socket);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith('cookie-token');
      expect(client.join).toHaveBeenCalledWith('resort:resort-1');
    });

    it('URL-decodes the cookie value', async () => {
      const client = fakeSocket({
        headers: { cookie: 'access_token=cookie%20token' },
      });
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-1',
        resortId: 'resort-1',
      });

      await gateway.handleConnection(client as unknown as Socket);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith('cookie token');
    });

    it('rejects and disconnects when no token can be found anywhere', async () => {
      const client = fakeSocket();

      await gateway.handleConnection(client as unknown as Socket);

      expect(jwtService.verifyAsync).not.toHaveBeenCalled();
      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Rejected desk socket connection socket-1'),
      );
    });

    it('rejects and disconnects when the cookie header has no matching cookie', async () => {
      const client = fakeSocket({ headers: { cookie: 'other=1' } });

      await gateway.handleConnection(client as unknown as Socket);

      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('rejects and disconnects when the decoded user has no resortId', async () => {
      const client = fakeSocket({ auth: { token: 'auth-token' } });
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-1',
        resortId: null,
      });

      await gateway.handleConnection(client as unknown as Socket);

      expect(client.join).not.toHaveBeenCalled();
      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Rejected desk socket connection socket-1'),
      );
    });

    it('rejects and disconnects when token verification throws', async () => {
      const client = fakeSocket({ auth: { token: 'bad-token' } });
      jwtService.verifyAsync.mockRejectedValue(
        new UnauthorizedException('invalid token'),
      );

      await gateway.handleConnection(client as unknown as Socket);

      expect(client.join).not.toHaveBeenCalled();
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });
  });

  describe('handleDisconnect', () => {
    it('logs the disconnect', () => {
      const client = fakeSocket();

      gateway.handleDisconnect(client as unknown as Socket);

      expect(logger.debug).toHaveBeenCalledWith(
        'Desk socket socket-1 disconnected',
      );
    });
  });

  describe('emitting to a resort room', () => {
    let server: { to: jest.Mock; emit: jest.Mock };

    beforeEach(() => {
      server = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
      gateway.server = server as unknown as Server;
    });

    it('emitNewMessage emits "newMessage" to the resort room', () => {
      gateway.emitNewMessage('resort-1', { hello: 'world' });

      expect(server.to).toHaveBeenCalledWith('resort:resort-1');
      expect(server.emit).toHaveBeenCalledWith('newMessage', {
        hello: 'world',
      });
    });

    it('emitMessageStatusUpdated emits "messageStatusUpdated" to the resort room', () => {
      gateway.emitMessageStatusUpdated('resort-1', { messageId: 'message-1' });

      expect(server.to).toHaveBeenCalledWith('resort:resort-1');
      expect(server.emit).toHaveBeenCalledWith('messageStatusUpdated', {
        messageId: 'message-1',
      });
    });
  });
});
