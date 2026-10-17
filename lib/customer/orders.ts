import "server-only";

import { createSecretSupabaseClient } from "@/lib/supabase/secret";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { CustomerIdentity } from "@/lib/customer/identity";
import { purchaseSnapshotSchema } from "@/lib/payments/schema";

const PAGE_SIZE = 12;
const CLAIM_BATCH_SIZE = 250;

// The caller must derive this identity from a fresh Auth getUser() result.
// Browser-supplied emails and order IDs never enter this operation.
export async function connectVerifiedGuestOrders(identity: CustomerIdentity) {
  const admin = createSecretSupabaseClient();
  let offset = 0;
  for (;;) {
    const result = await admin
      .from("orders")
      .select("id,created_at")
      .eq("customer_email", identity.email)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + CLAIM_BATCH_SIZE - 1);
    if (result.error)
      throw new Error("Previous orders could not be connected.");
    if (result.data.length) {
      const links = result.data.map((order) => ({
        order_id: order.id,
        user_id: identity.id,
        order_placed_at: order.created_at,
      }));
      const inserted = await admin
        .from("customer_order_links")
        .upsert(links, { onConflict: "order_id", ignoreDuplicates: true });
      if (inserted.error)
        throw new Error("Previous orders could not be connected.");
    }
    if (result.data.length < CLAIM_BATCH_SIZE) break;
    offset += CLAIM_BATCH_SIZE;
  }
}

export async function getCustomerOrders(
  identity: CustomerIdentity,
  page: number,
) {
  const client = await createServerSupabaseClient();
  const start = page * PAGE_SIZE;
  const links = await client
    .from("customer_order_links")
    .select("order_id")
    .eq("user_id", identity.id)
    .order("order_placed_at", { ascending: false })
    .order("order_id", { ascending: false })
    .range(start, start + PAGE_SIZE);
  if (links.error) throw new Error("Order history is temporarily unavailable.");
  const hasMore = links.data.length > PAGE_SIZE;
  const ids = links.data.slice(0, PAGE_SIZE).map((link) => link.order_id);
  if (!ids.length) return { orders: [], hasMore };
  const result = await client
    .from("orders")
    .select(
      "id,order_number,created_at,fulfillment_date,status,payment_status,fulfillment_status,snapshot",
    )
    .in("id", ids);
  if (result.error || result.data.length !== ids.length)
    throw new Error("Order history is temporarily unavailable.");
  const byId = new Map(result.data.map((order) => [order.id, order]));
  return {
    orders: ids.map((id) => {
      const order = byId.get(id)!;
      const snapshot = purchaseSnapshotSchema.safeParse(order.snapshot);
      return {
        id,
        number: order.order_number,
        placedAt: order.created_at,
        fulfillmentDate: order.fulfillment_date,
        status: order.status,
        paymentStatus: order.payment_status,
        fulfillmentStatus: order.fulfillment_status,
        totalCents: snapshot.success ? snapshot.data.totalCents : null,
        pastries: snapshot.success
          ? snapshot.data.validatedCart.lines
              .map((line) => line.product?.name)
              .filter((name): name is string => Boolean(name))
          : [],
      };
    }),
    hasMore,
  };
}

export function parseHistoryPage(value: unknown) {
  const page = typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isSafeInteger(page) && page >= 0 && page <= 1000 ? page : 0;
}
