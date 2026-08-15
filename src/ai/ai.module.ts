import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { GeminiAiClient } from './gemini-ai.client';
import { GroqAiClient } from './groq-ai.client';
import { HuggingFaceAiClient } from './huggingface-ai.client';
import { AI_CLIENT } from './ai-client.interface';

@Module({
  providers: [
    AiService,
    GeminiAiClient,
    // Kept available, not deleted — the active client is just a rebinding
    // below, so switching back is a one-line change if wanted.
    GroqAiClient,
    HuggingFaceAiClient,
    { provide: AI_CLIENT, useExisting: HuggingFaceAiClient },
  ],
  exports: [AiService],
})
export class AiModule {}
