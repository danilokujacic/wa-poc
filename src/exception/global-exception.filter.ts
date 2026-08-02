import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

// Postgres error codes we translate into a clean, client-safe HTTP response.
// Anything else falls through to a generic 500 — never the raw driver message.
const POSTGRES_ERROR_STATUS: Record<
  string,
  { status: HttpStatus; message: string }
> = {
  '23505': {
    status: HttpStatus.CONFLICT,
    message: 'A record with this value already exists.',
  },
  '23502': {
    status: HttpStatus.BAD_REQUEST,
    message: 'A required field was missing.',
  },
  '23503': {
    status: HttpStatus.BAD_REQUEST,
    message: 'This action references a record that does not exist.',
  },
  '23514': {
    status: HttpStatus.BAD_REQUEST,
    message: 'One or more fields had an invalid value.',
  },
  '22P02': {
    status: HttpStatus.BAD_REQUEST,
    message: 'One or more fields had an invalid value.',
  },
};

// Presentation layer never sees persistence-layer detail, and callers never
// see either: HttpExceptions thrown deliberately by services (e.g.
// `ConflictException('Email is already registered')`) carry a message the
// developer already wrote to be client-safe, so those pass through as-is.
// Anything else — a raw TypeORM/Postgres error, or a genuinely unexpected
// bug — is logged here with full detail and replaced with a generic,
// high-level message before it reaches the client.
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, message } = this.resolve(exception);

    this.logger.error(
      `[${request.method} ${request.url}] ${status} — ${exception instanceof Error ? exception.message : String(exception)}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }

  private resolve(exception: unknown): {
    status: HttpStatus;
    message: unknown;
  } {
    if (exception instanceof HttpException) {
      return {
        status: exception.getStatus(),
        message: exception.getResponse(),
      };
    }

    if (exception instanceof QueryFailedError) {
      const code = (exception as QueryFailedError & { code?: string }).code;
      const mapped = code ? POSTGRES_ERROR_STATUS[code] : undefined;
      return mapped
        ? { status: mapped.status, message: mapped.message }
        : {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Internal server error',
          };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    };
  }
}
