const mockGenerateContent = jest.fn();
jest.mock('@google/genai', () => {
  return {
    GoogleGenAI: jest.fn().mockImplementation(() => ({
      models: { generateContent: mockGenerateContent },
    })),
  };
});

import { GeminiAiClient } from './gemini-ai.client';

describe('GeminiAiClient', () => {
  let client: GeminiAiClient;

  beforeEach(() => {
    mockGenerateContent.mockReset();
    client = new GeminiAiClient();
  });

  it('calls the Gemini generateContent API with the given prompt', async () => {
    mockGenerateContent.mockResolvedValue({ text: 'Hello there' });

    const result = await client.generateReply('Hi');

    expect(mockGenerateContent).toHaveBeenCalledWith({
      model: 'gemini-3.5-flash',
      contents: 'Hi',
    });
    expect(result).toBe('Hello there');
  });

  it('falls back to an empty string when the response has no text', async () => {
    mockGenerateContent.mockResolvedValue({ text: undefined });

    const result = await client.generateReply('Hi');

    expect(result).toBe('');
  });
});
