export interface AiClient {
    generateReply(prompt: string): Promise<string>;
}

export const AI_CLIENT = Symbol('AI_CLIENT');
