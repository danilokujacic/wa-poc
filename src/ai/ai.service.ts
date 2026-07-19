import { Inject, Injectable, Logger } from '@nestjs/common';
import { AI_CLIENT } from './ai-client.interface';
import type { AiClient } from './ai-client.interface';
import AIClientException from 'src/exception/AIClientException';

@Injectable()
export class AiService {
    private readonly logger = new Logger(AiService.name);
    constructor(@Inject(AI_CLIENT) private readonly aiClient: AiClient) { }

    async generateReply(guestName: string, prompt: string): Promise<string> {
        try {
            return await this.aiClient.generateReply(prompt);
        } catch (error) {
            this.logger.error(`AI service unavailable for ${guestName}: ${error}`);
            throw new AIClientException("Failed to generate reply", 500);
        }
    }
}
