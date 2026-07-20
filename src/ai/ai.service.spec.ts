import { Test, TestingModule } from '@nestjs/testing';
import { getLoggerToken } from 'nestjs-pino';
import { AiService } from './ai.service';
import { AI_CLIENT } from './ai-client.interface';

describe('AiService', () => {
  let service: AiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: AI_CLIENT, useValue: { generateReply: jest.fn() } },
        { provide: getLoggerToken(AiService.name), useValue: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() } },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
