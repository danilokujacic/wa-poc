import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChannexWebhookGuard } from './channex-webhook.guard';

function contextWith(query: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ query }),
    }),
  } as unknown as ExecutionContext;
}

describe('ChannexWebhookGuard', () => {
  let configService: { get: jest.Mock };
  let guard: ChannexWebhookGuard;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    configService = { get: jest.fn() };
    guard = new ChannexWebhookGuard(configService as unknown as ConfigService);
    // The guard skips verification entirely outside production — force
    // production here so these tests actually exercise the token check.
    process.env.NODE_ENV = 'production';
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('skips verification outside production', () => {
    process.env.NODE_ENV = 'development';

    expect(guard.canActivate(contextWith({}))).toBe(true);
  });

  it('accepts a request whose query token matches the configured secret', () => {
    configService.get.mockReturnValue('secret-token');

    expect(guard.canActivate(contextWith({ token: 'secret-token' }))).toBe(
      true,
    );
  });

  it('rejects a request with a mismatched token', () => {
    configService.get.mockReturnValue('secret-token');

    expect(() =>
      guard.canActivate(contextWith({ token: 'wrong-token' })),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a request with no token in the query string', () => {
    configService.get.mockReturnValue('secret-token');

    expect(() => guard.canActivate(contextWith({}))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects when CHANNEX_WEBHOOK_TOKEN is not configured', () => {
    configService.get.mockReturnValue(undefined);

    expect(() => guard.canActivate(contextWith({ token: 'anything' }))).toThrow(
      UnauthorizedException,
    );
  });
});
