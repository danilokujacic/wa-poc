import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

interface S3Config {
  client: S3Client;
  bucket: string;
  publicUrlBase: string;
}

// Generic S3-compatible object storage — works unchanged against Cloudflare
// R2, self-hosted Minio, Backblaze B2, or real AWS S3. Only the endpoint/
// credentials/bucket differ per provider; the client code is identical.
// Default recommendation is R2 (see docs/PROD_READINESS.md): S3-compatible,
// zero egress fees, no extra load on the app's own VPS.
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  // Lazily built on first real use, not in the constructor — NestJS
  // instantiates every provider in the module graph eagerly at app boot
  // (or Test.createTestingModule().compile() time), so throwing here for
  // missing S3 credentials would fail the ENTIRE app's startup, not just
  // the image-upload feature, in any environment without S3 configured
  // (local dev, e2e tests, or before R2 is actually set up in production).
  // Matches the existing lazy-validation pattern already used by
  // ChannexApiClient for the same reason.
  private config: S3Config | undefined;

  private getConfig(): S3Config {
    if (this.config) {
      return this.config;
    }

    const endpoint = process.env.S3_ENDPOINT;
    const bucket = process.env.S3_BUCKET;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    const publicUrlBase = process.env.S3_PUBLIC_URL_BASE;

    if (
      !endpoint ||
      !bucket ||
      !accessKeyId ||
      !secretAccessKey ||
      !publicUrlBase
    ) {
      throw new InternalServerErrorException(
        'S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and S3_PUBLIC_URL_BASE must all be configured',
      );
    }

    this.config = {
      bucket,
      publicUrlBase: publicUrlBase.replace(/\/$/, ''),
      client: new S3Client({
        endpoint,
        region: process.env.S3_REGION ?? 'auto', // R2 uses "auto"
        credentials: { accessKeyId, secretAccessKey },
      }),
    };
    return this.config;
  }

  /**
   * Uploads a single file and returns its public URL.
   * `folder` namespaces keys (e.g. "resort-feature-images") to keep the
   * bucket organized; the actual filename is a random UUID plus the
   * original extension, never trusted user input.
   */
  async uploadFile(
    folder: string,
    originalName: string,
    body: Buffer,
    contentType: string,
  ): Promise<string> {
    const { client, bucket, publicUrlBase } = this.getConfig();
    const extension = originalName.includes('.')
      ? originalName.slice(originalName.lastIndexOf('.'))
      : '';
    const key = `${folder}/${randomUUID()}${extension}`;

    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    } catch (err) {
      this.logger.error(
        `Failed to upload ${key}: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new InternalServerErrorException('Failed to upload file');
    }

    return `${publicUrlBase}/${key}`;
  }
}
