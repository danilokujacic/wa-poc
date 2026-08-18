import { InternalServerErrorException } from '@nestjs/common';
import { HuggingFaceAiClient } from './huggingface-ai.client';

describe('HuggingFaceAiClient', () => {
  let client: HuggingFaceAiClient;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;
  const originalApiKey = process.env.HF_API_KEY;
  const originalModel = process.env.HF_MODEL;
  const originalBaseUrl = process.env.HF_BASE_URL;

  beforeEach(() => {
    process.env.HF_API_KEY = 'test-hf-key';
    delete process.env.HF_MODEL;
    delete process.env.HF_BASE_URL;
    client = new HuggingFaceAiClient();
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    process.env.HF_API_KEY = originalApiKey;
    process.env.HF_MODEL = originalModel;
    process.env.HF_BASE_URL = originalBaseUrl;
  });

  it('calls the Hugging Face router with the given prompt and bearer token', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: 'Hello there' } }] }),
        { status: 200 },
      ),
    );

    const result = await client.generateReply('Hi');

    /* eslint-disable @typescript-eslint/no-unsafe-assignment -- expect.objectContaining() is typed `any` by @types/jest */
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://router.huggingface.co/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-hf-key',
        }),
      }),
    );
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */
    const [, init] = fetchSpy.mock.calls[0];
    const body = JSON.parse(init!.body as string) as {
      model: string;
      messages: unknown;
    };
    expect(body.model).toBe('meta-llama/Llama-3.1-8B-Instruct');
    expect(body.messages).toEqual([{ role: 'user', content: 'Hi' }]);
    expect(result).toBe('Hello there');
  });

  it('uses HF_MODEL when set, instead of the default', async () => {
    process.env.HF_MODEL = 'meta-llama/custom-model';
    client = new HuggingFaceAiClient();
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: 'x' } }] }),
        {
          status: 200,
        },
      ),
    );

    await client.generateReply('Hi');

    const [, init] = fetchSpy.mock.calls[0];
    const body = JSON.parse(init!.body as string) as { model: string };
    expect(body.model).toBe('meta-llama/custom-model');
  });

  it('uses HF_BASE_URL when set, instead of the default router', async () => {
    process.env.HF_BASE_URL = 'https://example.test/v1/';
    client = new HuggingFaceAiClient();
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: 'x' } }] }),
        { status: 200 },
      ),
    );

    await client.generateReply('Hi');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://example.test/v1/chat/completions',
      expect.anything(),
    );
  });

  it('falls back to an empty string when there are no choices', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ choices: [] }), { status: 200 }),
    );

    const result = await client.generateReply('Hi');

    expect(result).toBe('');
  });

  it('throws when the request fails', async () => {
    fetchSpy.mockResolvedValue(new Response('rate limited', { status: 429 }));

    await expect(client.generateReply('Hi')).rejects.toThrow(
      'Hugging Face request failed: 429',
    );
  });

  it('throws when HF_API_KEY is not configured', async () => {
    delete process.env.HF_API_KEY;
    client = new HuggingFaceAiClient();

    await expect(client.generateReply('Hi')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
