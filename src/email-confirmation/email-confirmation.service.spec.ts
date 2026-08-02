import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { getLoggerToken } from 'nestjs-pino';
import { EmailConfirmationService } from './email-confirmation.service';
import { EmailConfirmationRepository } from '../repository/email-confirmation.repository';
import { MailService } from '../mail/mail.service';
import { User } from '../entity/user.entity';
import { EmailConfirmation } from '../entity/email-confirmation.entity';

describe('EmailConfirmationService', () => {
  let service: EmailConfirmationService;
  let emailConfirmationRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findValidBySlug: jest.Mock;
    remove: jest.Mock;
  };
  let mailService: { sendMail: jest.Mock };
  let configService: { get: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let manager: { update: jest.Mock; remove: jest.Mock };
  let logger: { info: jest.Mock };

  beforeEach(async () => {
    emailConfirmationRepository = {
      create: jest.fn((dto: Partial<EmailConfirmation>) => dto),
      save: jest.fn((entity: Partial<EmailConfirmation>) =>
        Promise.resolve(entity),
      ),
      findValidBySlug: jest.fn(),
      remove: jest.fn(),
    };
    mailService = {
      sendMail: jest.fn(),
    };
    configService = {
      get: jest.fn(),
    };
    manager = {
      update: jest.fn(),
      remove: jest.fn(),
    };
    dataSource = {
      transaction: jest.fn((cb: (manager: unknown) => Promise<unknown>) =>
        cb(manager),
      ),
    };
    logger = {
      info: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailConfirmationService,
        {
          provide: EmailConfirmationRepository,
          useValue: emailConfirmationRepository,
        },
        { provide: MailService, useValue: mailService },
        { provide: ConfigService, useValue: configService },
        { provide: DataSource, useValue: dataSource },
        {
          provide: getLoggerToken(EmailConfirmationService.name),
          useValue: logger,
        },
      ],
    }).compile();

    service = module.get<EmailConfirmationService>(EmailConfirmationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createAndSend', () => {
    const user = {
      id: 'user-1',
      email: 'jane@example.com',
      name: 'Jane',
    } as User;

    it('uses the configured expiry, persists a confirmation, logs and sends an email', async () => {
      configService.get.mockReturnValue(12);

      await service.createAndSend(user);

      expect(configService.get).toHaveBeenCalledWith(
        'EMAIL_CONFIRMATION_EXPIRY_HOURS',
        24,
      );
      expect(emailConfirmationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user,
          slug: expect.any(String) as string,
          code: expect.any(String) as string,
        }),
      );
      expect(emailConfirmationRepository.save).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(user.email),
      );
      expect(mailService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: user.email,
          subject: 'Confirm your email address',
          html: expect.stringContaining('12 hour(s)') as string,
        }),
      );
    });

    it('falls back to the default 24h expiry when not configured', async () => {
      configService.get.mockImplementation(
        (_key: string, defaultValue: number) => defaultValue,
      );

      await service.createAndSend(user);

      expect(mailService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('24 hour(s)') as string,
        }),
      );
    });
  });

  describe('confirm', () => {
    it('throws NotFoundException when no confirmation matches the slug', async () => {
      emailConfirmationRepository.findValidBySlug.mockResolvedValue(null);

      await expect(service.confirm('slug-1', 'code-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('removes and throws BadRequestException when the confirmation has expired', async () => {
      const confirmation = {
        id: 1,
        slug: 'slug-1',
        code: 'code-1',
        expires: new Date(Date.now() - 1000),
        user: { id: 'user-1' },
      };
      emailConfirmationRepository.findValidBySlug.mockResolvedValue(
        confirmation,
      );

      await expect(service.confirm('slug-1', 'code-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(emailConfirmationRepository.remove).toHaveBeenCalledWith(
        confirmation,
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the code does not match', async () => {
      const confirmation = {
        id: 1,
        slug: 'slug-1',
        code: 'correct-code',
        expires: new Date(Date.now() + 1000 * 60 * 60),
        user: { id: 'user-1' },
      };
      emailConfirmationRepository.findValidBySlug.mockResolvedValue(
        confirmation,
      );

      await expect(service.confirm('slug-1', 'wrong-code')).rejects.toThrow(
        BadRequestException,
      );
      expect(emailConfirmationRepository.remove).not.toHaveBeenCalled();
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('marks the user confirmed and removes the confirmation within a transaction on success', async () => {
      const confirmation = {
        id: 1,
        slug: 'slug-1',
        code: 'correct-code',
        expires: new Date(Date.now() + 1000 * 60 * 60),
        user: { id: 'user-1' },
      };
      emailConfirmationRepository.findValidBySlug.mockResolvedValue(
        confirmation,
      );

      await service.confirm('slug-1', 'correct-code');

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(manager.update).toHaveBeenCalledWith(User, 'user-1', {
        emailConfirmed: true,
      });
      expect(manager.remove).toHaveBeenCalledWith(confirmation);
    });
  });
});
