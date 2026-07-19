import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { GeminiAiClient } from './gemini-ai.client';
import { AI_CLIENT } from './ai-client.interface';

@Module({
    providers: [
        AiService,
        GeminiAiClient,
        { provide: AI_CLIENT, useExisting: GeminiAiClient },
    ],
    exports: [AiService],
})
export class AiModule { }
