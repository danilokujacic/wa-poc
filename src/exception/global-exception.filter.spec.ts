import {
  ArgumentsHost,
  BadRequestException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { GlobalExceptionFilter } from './global-exception.filter';

function hostWith(
  request: Record<string, unknown>,
  response: { status: jest.Mock; json: jest.Mock },
): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
}

function queryFailedError(code: string): QueryFailedError {
  const driverError = { code, message: `driver detail for ${code}` };
  return new QueryFailedError('SELECT 1', [], driverError as never);
}

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let response: { status: jest.Mock; json: jest.Mock };
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    loggerErrorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
  });

  it('maps an HttpException to its own status and response body, passing its message through as-is', () => {
    const request = { method: 'GET', url: '/resort/1' };
    const exception = new BadRequestException('Invalid input');

    filter.catch(exception, hostWith(request, response));

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        path: '/resort/1',
        message: exception.getResponse(),
      }),
    );
    expect(loggerErrorSpy).toHaveBeenCalled();
  });

  it('maps a non-HttpException to a generic 500 response and never leaks its message', () => {
    const request = { method: 'POST', url: '/resort/1/phone-change' };
    const exception = new Error(
      'boom — internal detail that must not reach the client',
    );

    filter.catch(exception, hostWith(request, response));

    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        path: '/resort/1/phone-change',
        message: 'Internal server error',
      }),
    );
    const loggedArgs = (loggerErrorSpy.mock.calls[0] as unknown[]).join(' ');
    expect(loggedArgs).toContain('boom');
  });

  it('maps a Postgres unique-violation (23505) to 409 with a generic message, logging the raw detail', () => {
    const request = { method: 'POST', url: '/resort' };
    const exception = queryFailedError('23505');

    filter.catch(exception, hostWith(request, response));

    expect(response.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.CONFLICT,
        message: 'A record with this value already exists.',
      }),
    );
    const loggedArgs = (loggerErrorSpy.mock.calls[0] as unknown[]).join(' ');
    expect(loggedArgs).toContain('driver detail for 23505');
  });

  it('maps a Postgres not-null violation (23502) to 400 with a generic message', () => {
    const exception = queryFailedError('23502');

    filter.catch(exception, hostWith({ method: 'POST', url: '/x' }, response));

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'A required field was missing.' }),
    );
  });

  it('maps an unrecognized Postgres error code to a generic 500, never leaking driver detail', () => {
    const exception = queryFailedError('99999');

    filter.catch(exception, hostWith({ method: 'POST', url: '/x' }, response));

    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Internal server error' }),
    );
  });

  it('includes an ISO timestamp in the response body', () => {
    const request = { method: 'GET', url: '/x' };

    filter.catch(new Error('boom'), hostWith(request, response));

    const calls = response.json.mock.calls as unknown as Array<
      [{ timestamp: string }]
    >;
    const body = calls[0][0];
    expect(() => new Date(body.timestamp).toISOString()).not.toThrow();
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });
});
