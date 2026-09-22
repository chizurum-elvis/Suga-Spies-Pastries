"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useCart } from "@/components/cart/cart-provider";
import { FulfillmentPlanner } from "@/components/checkout/fulfillment-planner";
import { Button } from "@/components/ui/button";
import {
  checkoutDraftSummarySchema,
  localMonthSchema,
} from "@/lib/fulfillment/schema";

const contextSchema = z.object({
  draft: checkoutDraftSummarySchema.nullable(),
  initialMonth: localMonthSchema,
});

export function CartDeliveryStep() {
  const router = useRouter();
  const { preferredDate, setPreferredDate, setDrawerStep, closeCart } =
    useCart();
  const [context, setContext] = useState<z.infer<typeof contextSchema> | null>(
    null,
  );
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setError(false);
      try {
        const response = await fetch("/api/checkout/fulfillment", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Date could not be loaded");
        const parsed = contextSchema.parse(await response.json());
        if (!controller.signal.aborted) setContext(parsed);
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    }
    void load();
    return () => controller.abort();
  }, [retry]);

  if (error)
    return (
      <div className="p-5" role="alert">
        <p className="text-ink font-bold">
          We could not load your delivery date.
        </p>
        <p className="text-ink-soft mt-2 text-sm">
          Your pastries are still in your cart.
        </p>
        <Button
          className="mt-4"
          variant="secondary"
          onClick={() => setRetry((value) => value + 1)}
        >
          Retry
        </Button>
      </div>
    );
  if (!context)
    return (
      <p role="status" className="text-ink-soft p-6 text-sm">
        Loading your delivery date…
      </p>
    );

  return (
    <FulfillmentPlanner
      initialDraft={context.draft}
      initialMonth={context.initialMonth}
      initialDate={preferredDate}
      drawer
      onDateChange={setPreferredDate}
      onBack={() => setDrawerStep("cart")}
      onSaved={() => {
        // Refresh the server draft even when editing from checkout itself.
        router.push("/checkout");
        router.refresh();
        closeCart();
      }}
    />
  );
}
