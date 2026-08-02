const mockCreate = jest.fn();
jest.mock('groq-sdk', () => {
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
});

import { GroqAiClient } from './groq-ai.client';

describe('GroqAiClient', () => {
  let client: GroqAiClient;

  beforeEach(() => {
    mockCreate.mockReset();
    client = new GroqAiClient();
  });

  it('calls the Groq chat completions API with the given prompt', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Hello there' } }],
    });

    const result = await client.generateReply('Hi');

    expect(mockCreate).toHaveBeenCalledWith({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'Hi' }],
    });
    expect(result).toBe('Hello there');
  });

  it('falls back to an empty string when there are no choices', async () => {
    mockCreate.mockResolvedValue({ choices: [] });

    const result = await client.generateReply('Hi');

    expect(result).toBe('');
  });

  it('falls back to an empty string when the message content is missing', async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: {} }] });

    const result = await client.generateReply('Hi');

    expect(result).toBe('');
  });
});
