// NOTE: AnthropicAiClient is not currently wired into ai.module.ts (only
// Gemini and Groq are registered as AI_CLIENT there) — this appears to be
// dead/unused code, but it's still shipped and compiled, so it's covered
// here the same way as the other AiClient implementations.
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }));
});

import { AnthropicAiClient } from './anthropic-ai.client';

describe('AnthropicAiClient', () => {
  let client: AnthropicAiClient;

  beforeEach(() => {
    mockCreate.mockReset();
    client = new AnthropicAiClient();
  });

  it('calls the Anthropic messages API and extracts the text block', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Hello there' }],
    });

    const result = await client.generateReply('Hi');

    expect(mockCreate).toHaveBeenCalledWith({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'Hi' }],
    });
    expect(result).toBe('Hello there');
  });

  it('falls back to an empty string when there is no text block', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'tool_use' }],
    });

    const result = await client.generateReply('Hi');

    expect(result).toBe('');
  });

  it('falls back to an empty string when content is empty', async () => {
    mockCreate.mockResolvedValue({ content: [] });

    const result = await client.generateReply('Hi');

    expect(result).toBe('');
  });
});
