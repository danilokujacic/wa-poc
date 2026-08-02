import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getLoggerToken } from 'nestjs-pino';
import * as nodemailer from 'nodemailer';
import { MailService } from './mail.service';

jest.mock('nodemailer');

describe('MailService', () => {
  let service: MailService;
  let configService: { get: jest.Mock };
  let logger: {
    info: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
    debug: jest.Mock;
  };
  let transporter: { verify: jest.Mock; sendMail: jest.Mock };
  let createTransportMock: jest.Mock;

  beforeEach(async () => {
    transporter = { verify: jest.fn(), sendMail: jest.fn() };
    createTransportMock = (
      nodemailer.createTransport as unknown as jest.Mock
    ).mockReturnValue(transporter);

    configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => defaultValue),
    };
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: ConfigService, useValue: configService },
        { provide: getLoggerToken(MailService.name), useValue: logger },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('builds the transporter without auth when SMTP_USER is not configured', () => {
    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({ auth: undefined }),
    );
  });

  it('builds the transporter with auth credentials when SMTP_USER is configured', async () => {
    createTransportMock.mockClear();
    configService.get.mockImplementation(
      (key: string, defaultValue?: unknown) => {
        if (key === 'SMTP_USER') return 'smtp-user';
        if (key === 'SMTP_PASS') return 'smtp-pass';
        return defaultValue;
      },
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: ConfigService, useValue: configService },
        { provide: getLoggerToken(MailService.name), useValue: logger },
      ],
    }).compile();
    module.get<MailService>(MailService);

    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: { user: 'smtp-user', pass: 'smtp-pass' },
      }),
    );
  });

  describe('onModuleInit', () => {
    it('logs success when the SMTP connection verifies', async () => {
      transporter.verify.mockResolvedValue(true);

      await service.onModuleInit();

      expect(logger.info).toHaveBeenCalledWith('SMTP connection verified');
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('logs a warning without throwing when verification fails', async () => {
      transporter.verify.mockRejectedValue(new Error('connection refused'));

      await expect(service.onModuleInit()).resolves.toBeUndefined();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('SMTP connection could not be verified'),
      );
    });
  });

  describe('sendMail', () => {
    it('sends the mail, stripping HTML tags for the text fallback when text is not given', async () => {
      transporter.sendMail.mockResolvedValue(undefined);

      await service.sendMail({
        to: 'guest@example.com',
        subject: 'Hi',
        html: '<p>Hello <b>there</b></p>',
      });

      expect(transporter.sendMail).toHaveBeenCalledWith({
        from: 'wa-poc <no-reply@wa-poc.example.com>',
        to: 'guest@example.com',
        subject: 'Hi',
        html: '<p>Hello <b>there</b></p>',
        text: 'Hello there',
      });
    });

    it('uses the explicit text when provided', async () => {
      transporter.sendMail.mockResolvedValue(undefined);

      await service.sendMail({
        to: 'guest@example.com',
        subject: 'Hi',
        html: '<p>Hello</p>',
        text: 'Plain text',
      });

      expect(transporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Plain text' }),
      );
    });

    it('logs the error and does not throw when sending fails', async () => {
      transporter.sendMail.mockRejectedValue(new Error('smtp unavailable'));

      await expect(
        service.sendMail({
          to: 'guest@example.com',
          subject: 'Hi',
          html: '<p>Hello</p>',
        }),
      ).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send email to guest@example.com'),
      );
    });
  });
});
