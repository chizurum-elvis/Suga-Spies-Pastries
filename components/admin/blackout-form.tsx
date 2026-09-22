"use client";

import { useActionState, useRef } from "react";
import { CalendarOff } from "lucide-react";
import { useRouter } from "next/navigation";

import { FulfillmentActionMessage } from "@/components/admin/fulfillment-action-message";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { initialFulfillmentActionState } from "@/lib/fulfillment/action-state";
import { createBlackout } from "@/lib/fulfillment/actions";

export function BlackoutForm({
  maximumDate,
  minimumDate,
}: {
  maximumDate: string;
  minimumDate: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  async function submitBlackout(
    previousState: typeof initialFulfillmentActionState,
    formData: FormData,
  ) {
    const nextState = await createBlackout(previousState, formData);
    if (nextState.status === "success") {
      formRef.current?.reset();
      router.refresh();
    }
    return nextState;
  }
  const [state, formAction, pending] = useActionState(
    submitBlackout,
    initialFulfillmentActionState,
  );

  return (
    <form ref={formRef} action={formAction} className="grid gap-4">
      <FulfillmentActionMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="blackout-date" label="Date" required>
          {(props) => (
            <Input
              {...props}
              name="date"
              type="date"
              min={minimumDate}
              max={maximumDate}
              required
            />
          )}
        </Field>
        <input type="hidden" name="scope" value="delivery" />
      </div>
      <Field
        id="blackout-public-reason"
        label="Customer-facing reason"
        description="Optional. Customers never see the private note below."
      >
        {(props) => (
          <Input
            {...props}
            name="publicReason"
            maxLength={120}
            placeholder="Unavailable for a private event"
          />
        )}
      </Field>
      <Field id="blackout-internal-note" label="Private owner note">
        {(props) => (
          <Textarea
            {...props}
            name="internalNote"
            maxLength={500}
            className="min-h-20"
          />
        )}
      </Field>
      <Button
        type="submit"
        variant="secondary"
        isLoading={pending}
        loadingLabel="Adding blackout…"
        className="justify-self-start"
      >
        <CalendarOff className="size-4" aria-hidden="true" />
        Add blackout
      </Button>
    </form>
  );
}
