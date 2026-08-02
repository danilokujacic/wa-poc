import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ACCESS_TOKEN_COOKIE } from '../auth.constants';

function contextWith(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let jwtService: { verifyAsync: jest.Mock };
  let guard: JwtAuthGuard;

  beforeEach(() => {
    jwtService = { verifyAsync: jest.fn() };
    guard = new JwtAuthGuard(jwtService as any);
  });

  it('verifies the token from the access token cookie and sets request.user', async () => {
    const payload = {
      sub: 'user-1',
      email: 'a@b.com',
      role: 'Owner',
      resortId: 'resort-1',
    };
    jwtService.verifyAsync.mockResolvedValue(payload);
    const request: Record<string, unknown> = {
      cookies: { [ACCESS_TOKEN_COOKIE]: 'cookie-token' },
      headers: {},
    };

    const result = await guard.canActivate(contextWith(request));

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('cookie-token');
    expect(request.user).toBe(payload);
    expect(result).toBe(true);
  });

  it('falls back to the Bearer authorization header when no cookie is present', async () => {
    const payload = {
      sub: 'user-1',
      email: 'a@b.com',
      role: 'Owner',
      resortId: 'resort-1',
    };
    jwtService.verifyAsync.mockResolvedValue(payload);
    const request: Record<string, unknown> = {
      cookies: {},
      headers: { authorization: 'Bearer header-token' },
    };

    const result = await guard.canActivate(contextWith(request));

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('header-token');
    expect(result).toBe(true);
  });

  it('prefers the cookie token over the authorization header when both are present', async () => {
    jwtService.verifyAsync.mockResolvedValue({});
    const request: Record<string, unknown> = {
      cookies: { [ACCESS_TOKEN_COOKIE]: 'cookie-token' },
      headers: { authorization: 'Bearer header-token' },
    };

    await guard.canActivate(contextWith(request));

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('cookie-token');
  });

  it('throws Missing auth token when no cookie or header token is present', async () => {
    const request: Record<string, unknown> = { cookies: {}, headers: {} };

    await expect(guard.canActivate(contextWith(request))).rejects.toThrow(
      new UnauthorizedException('Missing auth token'),
    );
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('throws Missing auth token when the authorization header is not a Bearer scheme', async () => {
    const request: Record<string, unknown> = {
      cookies: {},
      headers: { authorization: 'Basic something' },
    };

    await expect(guard.canActivate(contextWith(request))).rejects.toThrow(
      new UnauthorizedException('Missing auth token'),
    );
  });

  it('handles a request with no cookies object at all', async () => {
    const request: Record<string, unknown> = { headers: {} };

    await expect(guard.canActivate(contextWith(request))).rejects.toThrow(
      new UnauthorizedException('Missing auth token'),
    );
  });

  it('throws Invalid or expired token when verification fails', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('bad token'));
    const request: Record<string, unknown> = {
      cookies: { [ACCESS_TOKEN_COOKIE]: 'cookie-token' },
      headers: {},
    };

    await expect(guard.canActivate(contextWith(request))).rejects.toThrow(
      new UnauthorizedException('Invalid or expired token'),
    );
  });
});
