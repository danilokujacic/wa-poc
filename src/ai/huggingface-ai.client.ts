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
const HF_ROUTER_URL = 'https://router.huggingface.co/v1/chat/completions';

// Default model — verify this ID is still current/available on
// https://huggingface.co/models before relying on it; HF model IDs and
// provider availability do change. Override via HUGGINGFACE_MODEL.
const DEFAULT_MODEL = 'meta-llama/Llama-3.1-8B-Instruct';

interface HfChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: string;
}

@Injectable()
export class HuggingFaceAiClient implements AiClient {
  private readonly logger = new Logger(HuggingFaceAiClient.name);
  private readonly model = process.env.HUGGINGFACE_MODEL ?? DEFAULT_MODEL;

  async generateReply(prompt: string): Promise<string> {
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) {
      throw new InternalServerErrorException(
        'HUGGINGFACE_API_KEY is not configured',
      );
    }

    const response = await fetch(HF_ROUTER_URL, {
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
