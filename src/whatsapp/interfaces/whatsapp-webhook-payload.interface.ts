// Shape of Meta's WhatsApp Business webhook POST body — only the fields this
// app actually reads. See https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
export interface WhatsappWebhookMessage {
  id: string;
  from: string;
  type: string;
  timestamp: string;
  text?: { body: string };
}

export interface WhatsappWebhookValue {
  metadata?: { phone_number_id?: string };
  contacts?: Array<{ profile?: { name?: string } }>;
  messages?: WhatsappWebhookMessage[];
}

export interface WhatsappWebhookPayload {
  entry?: Array<{
    changes?: Array<{
      value?: WhatsappWebhookValue;
    }>;
  }>;
}
