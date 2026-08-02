import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AI_CLIENT } from './ai-client.interface';
import type { AiClient } from './ai-client.interface';
import AIClientException from 'src/exception/AIClientException';

@Injectable()
export class AiService {
  constructor(
    @Inject(AI_CLIENT) private readonly aiClient: AiClient,
    @InjectPinoLogger(AiService.name) private readonly logger: PinoLogger,
  ) {}

  async generateReply(guestName: string, prompt: string): Promise<string> {
    try {
      return await this.aiClient.generateReply(prompt);
    } catch (error) {
      this.logger.error(`AI service unavailable for ${guestName}: ${error}`);
      throw new AIClientException('Failed to generate reply', 500);
    }
  }
}
