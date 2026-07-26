export const DESK_EVENTS = {
    MESSAGE_RECEIVED: 'desk.message.received',
    AI_REPLIED: 'desk.message.ai-replied',
} as const;

export interface MessageReceivedEvent {
    resortId: string;
    guestPhoneNumber: string;
    body: string;
}

export interface AiRepliedEvent {
    resortId: string;
    guestPhoneNumber: string;
    body: string;
}
