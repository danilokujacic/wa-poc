import { Test, TestingModule } from '@nestjs/testing';
import { EmailConfirmationController } from './email-confirmation.controller';
import { EmailConfirmationService } from './email-confirmation.service';

describe('EmailConfirmationController', () => {
  let controller: EmailConfirmationController;
  let service: { confirm: jest.Mock };

  beforeEach(async () => {
    service = {
      confirm: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmailConfirmationController],
      providers: [{ provide: EmailConfirmationService, useValue: service }],
    }).compile();

    controller = module.get<EmailConfirmationController>(
      EmailConfirmationController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates confirm to the service with the slug and code', async () => {
    service.confirm.mockResolvedValue(undefined);

    await controller.confirm({ slug: 'slug-1', code: 'code-1' });

    expect(service.confirm).toHaveBeenCalledWith('slug-1', 'code-1');
  });
});
