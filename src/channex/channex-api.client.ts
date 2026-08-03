import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export class ChannexApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

interface ChannexEnvelope<T> {
  data: T;
  meta?: { total: number; limit: number; page: number };
}

// Shape of a Channex API response body — success or error. No runtime
// schema validation on external JSON here (matches the rest of this app's
// pattern for third-party API responses); this documents the expected
// shape per Channex's docs rather than proving it.
interface ChannexResponseBody {
  data?: unknown;
  meta?: { total: number; limit: number; page: number };
  errors?: {
    title?: string;
    code?: string;
    details?: unknown;
  };
}

@Injectable()
export class ChannexApiClient {
  private readonly logger = new Logger(ChannexApiClient.name);

  constructor(private readonly configService: ConfigService) {}

  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path).then((envelope) => envelope.data);
  }

  getWithMeta<T>(path: string): Promise<ChannexEnvelope<T>> {
    return this.request<T>('GET', path);
  }

  post<T = unknown>(path: string, body: unknown = {}): Promise<T> {
    return this.request<T>('POST', path, body).then(
      (envelope) => envelope.data,
    );
  }

  put<T = unknown>(path: string, body: unknown = {}): Promise<T> {
    return this.request<T>('PUT', path, body).then((envelope) => envelope.data);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<ChannexEnvelope<T>> {
    const apiKey = this.configService.get<string>('CHANNEX_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException(
        'CHANNEX_API_KEY is not configured',
      );
    }

    const baseUrl = this.configService.get<string>(
      'CHANNEX_API_BASE_URL',
      'https://staging.channex.io/api/v1',
    );

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'user-api-key': apiKey,
        'content-type': 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const raw = await response.text();
    const parsed: ChannexResponseBody | undefined = raw
      ? (JSON.parse(raw) as ChannexResponseBody)
      : undefined;

    if (!response.ok) {
      this.logger.error(parsed);
      const errors = parsed?.errors;
      this.logger.error(
        `Channex ${method} ${path} failed: ${response.status} ${errors?.title ?? raw}`,
      );
      const message = errors?.details
        ? `${errors.title}: ${JSON.stringify(errors.details)}`
        : (errors?.title ??
          `Channex request failed with status ${response.status}`);
      throw new ChannexApiError(
        message,
        response.status,
        errors?.code,
        errors?.details,
      );
    }

    return { data: parsed?.data as T, meta: parsed?.meta };
  }
}
