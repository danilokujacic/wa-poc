import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { GeminiAiClient } from './gemini-ai.client';
import { GroqAiClient } from './groq-ai.client';
import { AI_CLIENT } from './ai-client.interface';

@Module({
  providers: [
    AiService,
    GeminiAiClient,
    GroqAiClient,
    { provide: AI_CLIENT, useExisting: GroqAiClient },
  ],
  exports: [AiService],
})
export class AiModule {}
