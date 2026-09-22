"use client";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { FulfillmentActionMessage } from "@/components/admin/fulfillment-action-message";
import { initialFulfillmentActionState } from "@/lib/fulfillment/action-state";
import { updateDeliveryPricing } from "@/lib/delivery/actions";
import type { DeliveryPricing } from "@/lib/delivery/schema";

export function DeliveryPricingForm({
  settings,
}: {
  settings: DeliveryPricing & { version: number };
}) {
  const [state, action, pending] = useActionState(
    updateDeliveryPricing,
    initialFulfillmentActionState,
  );
  const router = useRouter();
  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state, router]);
  const fields = [
    {
      name: "baseDistance",
      label: "Base distance (km)",
      value: settings.base_distance_meters / 1000,
      max: 30,
    },
    {
      name: "baseFee",
      label: "Base delivery fee (CAD)",
      value: settings.base_fee_cents / 100,
      max: 1000,
    },
    {
      name: "extraFee",
      label: "Each extra kilometre (CAD)",
      value: settings.extra_km_fee_cents / 100,
      max: 100,
    },
    {
      name: "maximumDistance",
      label: "Maximum delivery distance (km)",
      value: settings.maximum_distance_meters / 1000,
      max: 30,
    },
    {
      name: "freeThreshold",
      label: "Free delivery from (CAD, pastries only)",
      value: settings.free_delivery_threshold_cents / 100,
      max: 10000,
    },
  ];
  return (
    <form action={action} className="grid max-w-2xl gap-5">
      <FulfillmentActionMessage state={state} />
      <input type="hidden" name="version" value={settings.version} />
      <div className="grid gap-5 sm:grid-cols-2">
        {fields.map((field) => (
          <Field
            key={field.name}
            id={`pricing-${field.name}`}
            label={field.label}
            required
          >
            {(props) => (
              <Input
                {...props}
                name={field.name}
                type="number"
                inputMode="decimal"
                min={field.name === "maximumDistance" ? 0.01 : 0}
                max={field.max}
                step="0.01"
                required
                defaultValue={field.value.toFixed(2)}
                disabled={pending}
              />
            )}
          </Field>
        ))}
      </div>
      <p className="text-ink-soft text-sm leading-6">
        Extra distance is charged proportionally, rounded once to the nearest
        cent. Free delivery still requires an eligible address within the
        delivery limit.
      </p>
      <Button
        type="submit"
        isLoading={pending}
        loadingLabel="Saving pricing…"
        className="justify-self-start"
      >
        Save delivery pricing
      </Button>
    </form>
  );
}
