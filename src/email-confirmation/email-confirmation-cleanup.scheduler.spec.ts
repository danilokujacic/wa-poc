import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { EmailConfirmationCleanupScheduler } from './email-confirmation-cleanup.scheduler';
import { EmailConfirmationRepository } from '../repository/email-confirmation.repository';

describe('EmailConfirmationCleanupScheduler', () => {
  let scheduler: EmailConfirmationCleanupScheduler;
  let repository: { deleteExpired: jest.Mock };

  beforeEach(async () => {
    repository = {
      deleteExpired: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailConfirmationCleanupScheduler,
        { provide: EmailConfirmationRepository, useValue: repository },
      ],
    }).compile();

    scheduler = module.get<EmailConfirmationCleanupScheduler>(
      EmailConfirmationCleanupScheduler,
    );
  });

  it('should be defined', () => {
    expect(scheduler).toBeDefined();
  });

  it('deletes expired confirmations and logs the deleted count', async () => {
    repository.deleteExpired.mockResolvedValue(3);
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    await scheduler.deleteExpiredConfirmations();

    expect(repository.deleteExpired).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      'Deleted 3 expired email confirmation(s)',
    );

    logSpy.mockRestore();
  });

  it('logs zero when nothing was deleted', async () => {
    repository.deleteExpired.mockResolvedValue(0);
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    await scheduler.deleteExpiredConfirmations();

    expect(logSpy).toHaveBeenCalledWith(
      'Deleted 0 expired email confirmation(s)',
    );

    logSpy.mockRestore();
  });
});
