import { Injectable } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { AiClient } from './ai-client.interface';

@Injectable()
export class GeminiAiClient implements AiClient {
    private readonly client = new GoogleGenAI({ apiKey: process.env.GEMINY_API_KEY });

    async generateReply(prompt: string): Promise<string> {
        const response = await this.client.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: prompt,
        });

        return response.text ?? '';
    }
}
