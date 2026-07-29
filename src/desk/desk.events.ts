export const DESK_EVENTS = {
    MESSAGE_RECEIVED: 'desk.message.received',
    AI_REPLIED: 'desk.message.ai-replied',
} as const;

export interface MessageReceivedEvent {
    resortId: string;
    guestPhoneNumber: string;
    body: string;
    /** ISO 8601 — WhatsApp's own send timestamp for this message. */
    sentAt: string;
    /** Correlation id for this flow: WhatsApp's own message id (wamid) — globally unique,
     * assigned by Meta, and already known before we've done anything with the message. */
    traceId: string;
}

export interface AiRepliedEvent {
    resortId: string;
    guestPhoneNumber: string;
    body: string;
    /** ISO 8601 — when the AI actually generated this reply. */
    sentAt: string;
    /** The resort's WhatsApp phone number id to send this reply from. */
    phoneNumberId: string;
    /** Correlation id for this flow: generated once per debounce/flush cycle, since one AI
     * turn can answer several batched guest messages and so can't reuse a single wamid. */
    traceId: string;
}
