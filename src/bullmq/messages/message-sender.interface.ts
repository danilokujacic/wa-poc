export interface MessageSender {
  sendText(phoneNumberId: string, to: string, text: string): Promise<void>;
}

export const MESSAGE_SENDER = Symbol('MESSAGE_SENDER');

/** Thrown by MessageSender implementations when the provider rejects a send, carrying the HTTP
 * status so callers (e.g. WaSendProcessor) can tell a permanent failure (bad credentials, invalid
 * recipient) apart from a transient one (rate limited, provider having a bad moment) and decide
 * whether retrying is even worth attempting. */
export class WhatsappSendError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'WhatsappSendError';
  }
}
