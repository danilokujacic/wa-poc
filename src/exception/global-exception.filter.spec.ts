import { ArgumentsHost, BadRequestException, HttpStatus } from '@nestjs/common';
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

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let response: { status: jest.Mock; json: jest.Mock };
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('maps an HttpException to its own status and response body', () => {
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
    expect(consoleErrorSpy).toHaveBeenCalledWith('[GET /resort/1]', exception);
  });

  it('maps a non-HttpException to a generic 500 response', () => {
    const request = { method: 'POST', url: '/resort/1/phone-change' };
    const exception = new Error('boom');

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
