export interface ChannexRoomStay {
  checkin_date?: string;
  checkout_date?: string;
  room_type_id?: string;
  rate_plan_id?: string;
  amount?: string;
  occupancy?: { adults?: number; children?: number; infants?: number };
  days?: Record<string, string>;
  guests?: Array<{ name?: string; surname?: string }>;
}

export interface ChannexBookingCustomer {
  name?: string;
  surname?: string;
  mail?: string;
  phone?: string;
  country?: string;
  address?: string;
}

export interface ChannexBookingRevisionAttributes {
  booking_id: string;
  status: 'new' | 'modified' | 'cancelled';
  property_id: string;
  ota_name?: string;
  ota_reservation_code?: string;
  arrival_date?: string;
  departure_date?: string;
  amount?: string;
  currency?: string;
  payment_collect?: 'ota' | 'property';
  customer?: ChannexBookingCustomer;
  rooms?: ChannexRoomStay[];
}

export interface ChannexBookingRevision {
  id: string;
  attributes: ChannexBookingRevisionAttributes;
}

export interface ChannexWebhookPayload {
  event: string;
  payload: {
    booking_id?: string;
    property_id?: string;
    revision_id: string;
  };
  user_id?: string | null;
  timestamp?: string;
}
