import { AdminLink as Link } from "@/components/navigation/admin-link";

import { ExternalOrderForm } from "@/components/admin/external-order-form";
import { Card } from "@/components/ui/card";
import { requireOwnerSession } from "@/lib/auth/session";
import {
  addCalendarDays,
  addCalendarMonths,
  getTorontoLocalDate,
} from "@/lib/fulfillment/rules";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function NewExternalOrderPage() {
  await requireOwnerSession("/admin/external-orders/new");
  const db = await createServerSupabaseClient();
  const [productsResult, settingsResult] = await Promise.all([
    db
      .from("products")
      .select("id,name,minimum_quantity,quantity_step,maximum_quantity")
      .eq("status", "published")
      .eq("is_available", true)
      .order("display_order")
      .order("name"),
    db
      .from("fulfillment_settings")
      .select("minimum_notice_days,booking_horizon_months")
      .eq("singleton", true)
      .single(),
  ]);
  const { data, error } = productsResult;
  if (error || !data || settingsResult.error || !settingsResult.data)
    throw new Error("The external order form could not be loaded.");
  const today = getTorontoLocalDate();
  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <header>
        <Link
          href="/admin/production"
          className="text-brand-strong text-sm font-bold underline"
        >
          ← Production plan
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.04em]">
          Record an external order
        </h1>
        <p className="text-ink-soft mt-2 max-w-2xl text-sm leading-6">
          For phone or Instagram orders already accepted by the owner. The
          address is checked against the same delivery area as online checkout.
        </p>
      </header>
      <Card tone="admin" padding="lg">
        {data.length ? (
          <ExternalOrderForm
            minimumDate={addCalendarDays(
              today,
              settingsResult.data.minimum_notice_days,
            )}
            maximumDate={addCalendarMonths(
              today,
              settingsResult.data.booking_horizon_months,
            )}
            products={data.map((row) => ({
              id: row.id,
              name: row.name,
              minimumQuantity: row.minimum_quantity,
              quantityStep: row.quantity_step,
              maximumQuantity: row.maximum_quantity,
            }))}
          />
        ) : (
          <p className="text-ink-soft">
            Publish an available pastry before recording an external order.
          </p>
        )}
      </Card>
    </div>
  );
}
