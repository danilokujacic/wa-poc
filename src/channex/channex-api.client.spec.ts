import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChannexApiClient, ChannexApiError } from './channex-api.client';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response;
}

describe('ChannexApiClient', () => {
  let client: ChannexApiClient;
  let configService: { get: jest.Mock };
  const originalFetch = global.fetch;

  beforeEach(async () => {
    configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'CHANNEX_API_KEY') return 'test-api-key';
        if (key === 'CHANNEX_API_BASE_URL') return fallback;
        return undefined;
      }),
    };
    global.fetch = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannexApiClient,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    client = module.get<ChannexApiClient>(ChannexApiClient);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('performs a GET and unwraps the envelope data', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse(200, { data: { id: 'room-1' } }),
    );

    const result = await client.get<{ id: string }>('/room_types/room-1');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://staging.channex.io/api/v1/room_types/room-1',
      {
        method: 'GET',
        headers: {
          'user-api-key': 'test-api-key',
          'content-type': 'application/json',
        },
        body: undefined,
      },
    );
    expect(result).toEqual({ id: 'room-1' });
  });

  it('performs a POST with a JSON body and unwraps the envelope data', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse(201, { data: { id: 'new-1' } }),
    );

    const result = await client.post<{ id: string }>('/room_types', {
      room_type: { title: 'Cabana' },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://staging.channex.io/api/v1/room_types',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ room_type: { title: 'Cabana' } }),
      }),
    );
    expect(result).toEqual({ id: 'new-1' });
  });

  it('performs a PUT with a JSON body and unwraps the envelope data', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse(200, { data: { id: 'room-1' } }),
    );

    const result = await client.put<{ id: string }>('/room_types/room-1', {
      room_type: { title: 'Updated' },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://staging.channex.io/api/v1/room_types/room-1',
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(result).toEqual({ id: 'room-1' });
  });

  it('returns meta alongside data for getWithMeta', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse(200, {
        data: [{ id: 'r1' }],
        meta: { total: 1, limit: 100, page: 1 },
      }),
    );

    const result = await client.getWithMeta('/booking_revisions/feed');

    expect(result).toEqual({
      data: [{ id: 'r1' }],
      meta: { total: 1, limit: 100, page: 1 },
    });
  });

  it('throws InternalServerErrorException when CHANNEX_API_KEY is not configured', async () => {
    configService.get.mockImplementation((key: string, fallback?: unknown) =>
      key === 'CHANNEX_API_KEY' ? undefined : fallback,
    );

    await expect(client.get('/room_types')).rejects.toThrow(
      InternalServerErrorException,
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('throws a ChannexApiError with status/code/details extracted from a non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse(422, {
        errors: {
          title: 'Validation failed',
          code: 'validation_error',
          details: { title: ['is required'] },
        },
      }),
    );

    let thrown: unknown;
    try {
      await client.post('/room_types', {});
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(ChannexApiError);
    const error = thrown as ChannexApiError;
    expect(error.status).toBe(422);
    expect(error.code).toBe('validation_error');
    expect(error.details).toEqual({ title: ['is required'] });
    expect(error.message).toContain('Validation failed');
  });

  it('falls back to a generic message when a non-ok response has no error envelope', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve(''),
    });

    let thrown: unknown;
    try {
      await client.get('/room_types');
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(ChannexApiError);
    expect((thrown as ChannexApiError).status).toBe(500);
    expect((thrown as ChannexApiError).message).toContain(
      'Channex request failed with status 500',
    );
  });

  it('does not crash JSON.parse on an empty response body', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 204,
      text: () => Promise.resolve(''),
    });

    const result = await client.get('/room_types/room-1');

    expect(result).toBeUndefined();
  });
});
