const mockSend = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  PutObjectCommand: jest
    .fn()
    .mockImplementation((input: unknown) => ({ input })),
}));

import { InternalServerErrorException } from '@nestjs/common';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  const env = { ...process.env };

  beforeEach(() => {
    mockSend.mockReset();
    process.env.S3_ENDPOINT = 'https://accountid.r2.cloudflarestorage.com';
    process.env.S3_BUCKET = 'wa-poc-images';
    process.env.S3_ACCESS_KEY_ID = 'test-key';
    process.env.S3_SECRET_ACCESS_KEY = 'test-secret';
    process.env.S3_PUBLIC_URL_BASE = 'https://images.example.com/';
  });

  afterEach(() => {
    process.env = { ...env };
  });

  it('uploads a file and returns its public URL, namespaced by folder with a random key', async () => {
    mockSend.mockResolvedValue({});
    const service = new StorageService();

    const url = await service.uploadFile(
      'resort-feature-images',
      'cabana.jpg',
      Buffer.from('fake image bytes'),
      'image/jpeg',
    );

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(url).toMatch(
      /^https:\/\/images\.example\.com\/resort-feature-images\/[0-9a-f-]+\.jpg$/,
    );
  });

  it('does not throw at construction time even with no S3 env vars set — the app must still boot without S3 configured', () => {
    process.env = {};

    expect(() => new StorageService()).not.toThrow();
  });

  it('throws only once actually uploading, when required S3 env vars are missing', async () => {
    delete process.env.S3_BUCKET;
    const service = new StorageService();

    await expect(
      service.uploadFile(
        'resort-feature-images',
        'x.png',
        Buffer.from(''),
        'image/png',
      ),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('throws a generic error when the upload fails, without leaking the raw SDK error', async () => {
    mockSend.mockRejectedValue(new Error('AccessDenied: bad credentials'));
    const service = new StorageService();

    await expect(
      service.uploadFile(
        'resort-feature-images',
        'x.png',
        Buffer.from(''),
        'image/png',
      ),
    ).rejects.toThrow('Failed to upload file');
  });
});
