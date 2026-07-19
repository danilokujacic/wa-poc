import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AiClient } from './ai-client.interface';

@Injectable()
export class AnthropicAiClient implements AiClient {
    private readonly client = new Anthropic();

    async generateReply(prompt: string): Promise<string> {
        const response = await this.client.messages.create({
            model: 'claude-opus-4-8',
            max_tokens: 1024,
            messages: [{ role: 'user', content: prompt }],
        });

        const textBlock = response.content.find((block) => block.type === 'text');
        return textBlock?.type === 'text' ? textBlock.text : '';
    }
}
