const redisConstructor = jest.fn();

jest.mock('ioredis', () => ({
  __esModule: true,
  default: class {
    constructor(...args: unknown[]) {
      redisConstructor(...args);
    }
  },
}));

// require() (not a static import) so the module is re-evaluated fresh after
// jest.resetModules(), picking up the env vars set for each test case.
function loadRedisProvider(): typeof import('./redis.provider') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./redis.provider') as typeof import('./redis.provider');
}

describe('redisProvider', () => {
  const originalHost = process.env.REDIS_HOST;
  const originalPort = process.env.REDIS_PORT;

  afterEach(() => {
    process.env.REDIS_HOST = originalHost;
    process.env.REDIS_PORT = originalPort;
    jest.resetModules();
    redisConstructor.mockClear();
  });

  it('creates the Redis client using REDIS_HOST/REDIS_PORT env vars when set', () => {
    process.env.REDIS_HOST = 'redis-host';
    process.env.REDIS_PORT = '6380';

    jest.resetModules();
    const { redisProvider } = loadRedisProvider();
    const factory = (redisProvider as { useFactory: () => unknown }).useFactory;
    factory();

    expect(redisConstructor).toHaveBeenCalledWith({
      host: 'redis-host',
      port: 6380,
    });
  });

  it('falls back to localhost:6379 when env vars are not set', () => {
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;

    jest.resetModules();
    const { redisProvider } = loadRedisProvider();
    const factory = (redisProvider as { useFactory: () => unknown }).useFactory;
    factory();

    expect(redisConstructor).toHaveBeenCalledWith({
      host: 'localhost',
      port: 6379,
    });
  });
});
