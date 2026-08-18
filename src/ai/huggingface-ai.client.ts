import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { AiClient } from './ai-client.interface';

// Hugging Face's "Inference Providers" router — an OpenAI-compatible chat
// completions endpoint in front of many hosted models/providers under one
// token, including Llama. See
// https://huggingface.co/docs/inference-providers/tasks/chat-completion
// Override via HF_BASE_URL (no trailing slash, no /chat/completions suffix).
const DEFAULT_BASE_URL = 'https://router.huggingface.co/v1';

// Default model — verify this ID is still current/available on
// https://huggingface.co/models before relying on it; HF model IDs and
// provider availability do change. Override via HF_MODEL.
const DEFAULT_MODEL = 'meta-llama/Llama-3.1-8B-Instruct';

interface HfChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: string;
}

@Injectable()
export class HuggingFaceAiClient implements AiClient {
  private readonly logger = new Logger(HuggingFaceAiClient.name);
  private readonly model = process.env.HF_MODEL ?? DEFAULT_MODEL;
  private readonly baseUrl = (
    process.env.HF_BASE_URL ?? DEFAULT_BASE_URL
  ).replace(/\/$/, '');

  async generateReply(prompt: string): Promise<string> {
    const apiKey = process.env.HF_API_KEY;
    if (!apiKey) {
      throw new InternalServerErrorException('HF_API_KEY is not configured');
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(
        `Hugging Face request failed: ${response.status} ${body}`,
      );
      throw new InternalServerErrorException(
        `Hugging Face request failed: ${response.status}`,
      );
    }

    const data = (await response.json()) as HfChatCompletionResponse;
    return data.choices?.[0]?.message?.content ?? '';
  }
}
