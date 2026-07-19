import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import { AI_CLIENT } from './ai-client.interface';

describe('AiService', () => {
  let service: AiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: AI_CLIENT, useValue: { generateReply: jest.fn() } },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
