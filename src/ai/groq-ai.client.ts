import { Injectable } from '@nestjs/common';
import Groq from 'groq-sdk';
import { AiClient } from './ai-client.interface';

@Injectable()
export class GroqAiClient implements AiClient {
    private readonly client = new Groq({ apiKey: process.env.GROQ_API_KEY });

    async generateReply(prompt: string): Promise<string> {
        const response = await this.client.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
        });

        return response.choices[0]?.message?.content ?? '';
    }
}
