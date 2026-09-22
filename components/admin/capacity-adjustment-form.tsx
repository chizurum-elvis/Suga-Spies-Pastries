"use client";

import { useActionState, useEffect, useRef } from "react";
import { CalendarPlus } from "lucide-react";
import { useRouter } from "next/navigation";

import { FulfillmentActionMessage } from "@/components/admin/fulfillment-action-message";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { initialFulfillmentActionState } from "@/lib/fulfillment/action-state";
import { createCapacityAdjustment } from "@/lib/fulfillment/actions";

export function CapacityAdjustmentForm({
  maximumDate,
  minimumDate,
}: {
  maximumDate: string;
  minimumDate: string;
}) {
  const [state, formAction, pending] = useActionState(
    createCapacityAdjustment,
    initialFulfillmentActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      router.refresh();
    }
  }, [router, state.status, state.submissionId]);
  return (
    <form ref={formRef} action={formAction} className="grid gap-4">
      <FulfillmentActionMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="capacity-date" label="Fulfillment date" required>
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
        <Field id="capacity-source" label="Order source" required>
          {(props) => (
            <Select {...props} name="source" defaultValue="phone" required>
              <option value="phone">Phone</option>
              <option value="instagram">Instagram</option>
              <option value="admin">Entered by owner</option>
              <option value="other">Other</option>
            </Select>
          )}
        </Field>
      </div>
      <Field
        id="capacity-reference"
        label="Customer or order reference"
        description="Use a short reference—not payment or sensitive information."
      >
        {(props) => (
          <Input {...props} name="customerReference" maxLength={80} />
        )}
      </Field>
      <Field id="capacity-note" label="Private note">
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
        loadingLabel="Checking capacity…"
        className="justify-self-start"
      >
        <CalendarPlus className="size-4" aria-hidden="true" />
        Use one order space
      </Button>
    </form>
  );
}
