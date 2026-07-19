export interface MessageSender {
    sendText(phoneNumberId: string, to: string, text: string): Promise<void>;
}

export const MESSAGE_SENDER = Symbol('MESSAGE_SENDER');
