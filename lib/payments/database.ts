import type { Json } from "@/lib/supabase/database.types";
import type { FulfillmentStatus, OrderStatus } from "@/lib/orders/status";
import type {
  OrderPaymentStatus,
  RefundStatus,
} from "@/lib/orders/cancellation";

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
  customer_email?: string | null;
  payment_attempt_id: string;
  capacity_adjustment_id: string;
  fulfillment_date: string;
  status: OrderStatus;
  payment_status: OrderPaymentStatus;
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
  event_type: "fulfillment_status" | "cancellation" | "redelivery";
  from_status: FulfillmentStatus | null;
  to_status:
    | FulfillmentStatus
    | "cancelled"
    | "redelivery_date_selected"
    | "redelivery_payment_expired";
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
    | "customer_cancelled"
    | "owner_cancellation"
    | "owner_refund_attention"
    | "customer_delivery_failed"
    | "customer_redelivery_requested"
    | "customer_redelivery_date_selected"
    | `customer_redelivery_date_selected:${string}`
    | "customer_redelivery_scheduled"
    | "customer_redelivery_out_for_delivery"
    | "customer_order_discarded"
    | "owner_redelivery_requested"
    | "owner_delivery_failed"
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
export type OrderRefundRow = {
  id: string;
  order_id: string;
  payment_attempt_id: string;
  amount_cents: number;
  currency: string;
  test_only: boolean;
  requested_by: "customer" | "owner" | "system";
  actor_user_id: string | null;
  reason: string | null;
  status: RefundStatus;
  stripe_payment_intent_id: string;
  stripe_refund_id: string | null;
  requested_at: string;
  updated_at: string;
  completed_at: string | null;
  first_attempt_at: string | null;
  attempts: number;
  next_attempt_at: string;
  lease_id: string | null;
  lease_until: string | null;
  failure_code: string | null;
};
export type RedeliveryRow = {
  order_id: string;
  state:
    | "awaiting_customer"
    | "awaiting_owner"
    | "awaiting_payment"
    | "payment_review"
    | "scheduled"
    | "out_for_delivery"
    | "delivered"
    | "discarded";
  fault: "customer" | "business";
  failure_reason: string;
  failed_at: string;
  respond_by: string;
  requested_at: string | null;
  requested_address: Json | null;
  distance_meters: number | null;
  fee_cents: number | null;
  free_reason: "original_free" | "business_fault" | null;
  selected_date: string | null;
  capacity_adjustment_id: string | null;
  payment_expires_at: string | null;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  payment_status:
    | "not_required"
    | "pending"
    | "paid"
    | "refund_pending"
    | "refunded"
    | "needs_review";
  version: number;
  updated_at: string;
};
export type RedeliveryFeeRefundRow = OrderRefundRow & {
  requested_by: "owner" | "system";
};
type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};
export type PaymentTables = {
  order_refunds: Table<OrderRefundRow>;
  order_redeliveries: Table<RedeliveryRow>;
  redelivery_fee_refunds: Table<RedeliveryFeeRefundRow>;
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
  allow_redelivery_provider_request: {
    Args: { p_order_id: string };
    Returns: boolean;
  };
  mark_delivery_failed: {
    Args: {
      p_order_id: string;
      p_expected_version: number;
      p_fault: "customer" | "business";
      p_reason: string;
    };
    Returns: boolean;
  };
  request_redelivery: {
    Args: {
      p_order_id: string;
      p_expected_version: number;
      p_address: Json;
      p_distance_meters: number;
    };
    Returns: boolean;
  };
  select_redelivery_date: {
    Args: { p_order_id: string; p_expected_version: number; p_date: string };
    Returns: boolean;
  };
  begin_redelivery_payment: {
    Args: { p_order_id: string; p_expected_version: number };
    Returns: RedeliveryRow;
  };
  save_redelivery_session: {
    Args: { p_order_id: string; p_session_id: string };
    Returns: boolean;
  };
  resolve_redelivery_payment: {
    Args: {
      p_order_id: string;
      p_action: string;
      p_session_id: string;
      p_payment_id?: string;
      p_paid_at?: string;
    };
    Returns: string;
  };
  mark_redelivery_outcome: {
    Args: {
      p_order_id: string;
      p_expected_version: number;
      p_outcome: "out_for_delivery" | "delivered" | "failed";
    };
    Returns: boolean;
  };
  expire_failed_deliveries: { Args: { p_limit?: number }; Returns: number };
  expire_unstarted_redelivery_payment: {
    Args: { p_order_id: string };
    Returns: boolean;
  };
  claim_redelivery_fee_refunds: {
    Args: { p_test_only: boolean; p_refund_id?: string };
    Returns: RedeliveryFeeRefundRow[];
  };
  resolve_redelivery_fee_refund: {
    Args: {
      p_refund_id: string;
      p_lease_id: string;
      p_status: RefundStatus;
      p_provider_id?: string;
      p_failure_code?: string;
    };
    Returns: boolean;
  };
  cancel_order: {
    Args: { p_order_id: string; p_expected_version: number; p_reason?: string };
    Returns: string;
  };
  claim_order_refunds: {
    Args: { p_test_only: boolean; p_refund_id?: string };
    Returns: OrderRefundRow[];
  };
  resolve_order_refund: {
    Args: {
      p_refund_id: string;
      p_lease_id: string;
      p_status: RefundStatus;
      p_provider_id?: string;
      p_failure_code?: string;
    };
    Returns: boolean;
  };
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
