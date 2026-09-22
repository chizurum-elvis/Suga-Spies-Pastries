import { DeliveryPricingForm } from "@/components/admin/delivery-pricing-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function DeliveryPricingPage() {
  const db = await createServerSupabaseClient();
  const { data, error } = await db
    .from("delivery_settings")
    .select(
      "version, base_distance_meters, base_fee_cents, extra_km_fee_cents, maximum_distance_meters, free_delivery_threshold_cents",
    )
    .eq("singleton", true)
    .single();
  if (error || !data)
    throw new Error("Delivery pricing is temporarily unavailable.");
  return (
    <div className="grid gap-8">
      <header>
        <h1 className="text-3xl font-extrabold">Delivery pricing</h1>
        <p className="text-ink-soft mt-3 max-w-2xl text-sm leading-6">
          Manage the current rates for Toronto, Markham, and Mississauga.
          Changes apply to new quotes; customers must review a changed fee
          before continuing.
        </p>
      </header>
      <section className="border-border border bg-white p-5 sm:p-7">
        <DeliveryPricingForm key={data.version} settings={data} />
      </section>
    </div>
  );
}
