import type { Json } from "@/lib/supabase/database.types";
import type { FulfillmentStatus, OrderStatus } from "@/lib/orders/status";

export type PaymentAttemptRow = {
  id: string;
  checkout_draft_id: string;
  hold_id: string;
  access_token_hash: string;
  review_token: string;
  snapshot: Json;
  total_cents: number;
  currency: string;
  test_only: boolean;
  status:
    | "creating"
    | "open"
    | "processing"
    | "paid"
    | "expired"
    | "refund_pending"
    | "refunded"
    | "needs_review";
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_refund_id: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
  next_reconcile_at: string;
  reconcile_count: number;
  failure_code: string | null;
};
export type OrderRow = {
  id: string;
  order_number: string;
  payment_attempt_id: string;
  capacity_adjustment_id: string;
  fulfillment_date: string;
  status: OrderStatus;
  payment_status: "paid";
  fulfillment_status: FulfillmentStatus;
  snapshot: Json;
  test_only: boolean;
  created_at: string;
  updated_at: string;
  version: number;
};
export type OrderEventRow = {
  id: string;
  order_id: string;
  event_type: "fulfillment_status";
  from_status: FulfillmentStatus | null;
  to_status: FulfillmentStatus;
  customer_title: string;
  customer_message: string;
  customer_visible: boolean;
  actor_user_id: string | null;
  idempotency_key: string;
  metadata: Json;
  occurred_at: string;
};
export type NotificationRow = {
  id: string;
  order_id: string | null;
  payment_attempt_id: string;
  order_event_id: string | null;
  kind:
    | "customer_confirmation"
    | "customer_preparing"
    | "customer_ready"
    | "customer_out_for_delivery"
    | "customer_delivered"
    | "owner_order"
    | "owner_exception";
  status: "pending" | "sending" | "sent" | "failed";
  attempts: number;
  lease_id: string | null;
  first_attempt_at: string | null;
  next_attempt_at: string;
  sent_at: string | null;
  provider_id: string | null;
  failure_code: string | null;
};
type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};
export type PaymentTables = {
  payment_worker_health: Table<{ mode: "test" | "live"; checked_at: string }>;
  payment_attempts: Table<PaymentAttemptRow>;
  orders: Table<OrderRow>;
  order_events: Table<OrderEventRow>;
  order_notifications: Table<NotificationRow>;
  payment_events: Table<{
    event_id: string;
    payment_attempt_id: string;
    action: string;
    created_at: string;
  }>;
};
export type PaymentFunctions = {
  begin_wallet_payment: {
    Args: {
      p_draft_id: string;
      p_draft_version: number;
      p_details_version: number;
      p_review_token: string;
      p_snapshot: Json;
    };
    Returns: string;
  };
  resolve_wallet_payment: {
    Args: {
      p_attempt_id: string;
      p_action: string;
      p_event_id: string;
      p_session_id: string;
      p_payment_id?: string;
      p_amount?: number;
      p_currency?: string;
      p_live?: boolean;
    };
    Returns: string | null;
  };
  claim_order_notifications: {
    Args: { p_limit?: number };
    Returns: NotificationRow[];
  };
  transition_order_fulfillment: {
    Args: {
      p_order_id: string;
      p_expected_status: FulfillmentStatus;
      p_next_status: FulfillmentStatus;
      p_expected_version: number;
      p_idempotency_key: string;
    };
    Returns: Array<{
      order_id: string;
      fulfillment_status: FulfillmentStatus;
      order_status: OrderStatus;
      order_version: number;
      order_updated_at: string;
      event_id: string;
    }>;
  };
  retry_order_notification: {
    Args: { p_order_id: string; p_notification_id: string };
    Returns: boolean;
  };
};
