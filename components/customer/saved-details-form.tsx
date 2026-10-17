"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { initialDetailsState } from "@/lib/customer/action-state";
import {
  removeCustomerDetails,
  saveCustomerDetails,
} from "@/lib/customer/actions";
import type { CustomerProfile } from "@/lib/customer/profile";

export function SavedDetailsForm({
  email,
  profile,
  message,
}: {
  email: string;
  profile: CustomerProfile | null;
  message?: string;
}) {
  const [state, action, pending] = useActionState(
    saveCustomerDetails,
    initialDetailsState,
  );
  const messageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.submissionId) messageRef.current?.focus();
  }, [state.submissionId]);
  return (
    <div className="grid max-w-3xl gap-6">
      {message === "removed" ? (
        <p
          role="status"
          className="border-sage-ink/20 bg-sage/70 text-sage-ink border p-4 text-sm font-bold"
        >
          Your saved details were removed.
        </p>
      ) : null}
      {message === "remove_failed" ? (
        <p
          role="alert"
          className="border-critical-ink/20 bg-critical text-critical-ink border p-4 text-sm font-bold"
        >
          We could not remove your details. Please retry.
        </p>
      ) : null}
      <form
        action={action}
        noValidate
        className="border-border bg-surface-raised grid gap-6 border p-5 sm:p-7"
      >
        {state.message ? (
          <div
            ref={messageRef}
            role={state.status === "error" ? "alert" : "status"}
            tabIndex={-1}
            className={
              state.status === "error"
                ? "border-critical-ink/20 bg-critical text-critical-ink border p-4 text-sm font-bold outline-none"
                : "border-sage-ink/20 bg-sage/70 text-sage-ink border p-4 text-sm font-bold outline-none"
            }
          >
            {state.message}
          </div>
        ) : null}
        <div>
          <h2 className="text-ink text-lg font-bold">Contact</h2>
          <p className="text-ink-soft mt-1 text-sm leading-6">
            Your verified account email is {email}. Order updates go to the
            email you confirm at checkout.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="saved-name"
            label="Full name"
            error={state.errors?.name}
            required
          >
            {(control) => (
              <Input
                {...control}
                name="name"
                autoComplete="name"
                defaultValue={profile?.full_name ?? ""}
                maxLength={100}
                required
                disabled={pending}
              />
            )}
          </Field>
          <Field
            id="saved-phone"
            label="Canadian phone number"
            description="A 10-digit Canadian number for delivery contact."
            error={state.errors?.phone}
            required
          >
            {(control) => (
              <Input
                {...control}
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="416 555 0100"
                defaultValue={profile?.phone ?? ""}
                maxLength={30}
                required
                disabled={pending}
              />
            )}
          </Field>
        </div>
        <div className="border-border border-t pt-6">
          <h2 className="text-ink text-lg font-bold">Delivery address</h2>
          <p className="text-ink-soft mt-1 text-sm leading-6">
            Saving an address does not reserve a delivery date or guarantee it
            is in range. We check it again for every order.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="saved-recipient"
            label="Recipient name"
            error={state.errors?.recipientName}
            required
            className="sm:col-span-2"
          >
            {(control) => (
              <Input
                {...control}
                name="recipientName"
                autoComplete="shipping name"
                defaultValue={profile?.recipient_name ?? ""}
                maxLength={100}
                required
                disabled={pending}
              />
            )}
          </Field>
          <Field
            id="saved-line1"
            label="Street address"
            error={state.errors?.["address.line1"]}
            required
            className="sm:col-span-2"
          >
            {(control) => (
              <Input
                {...control}
                name="line1"
                autoComplete="shipping address-line1"
                defaultValue={profile?.address_line1 ?? ""}
                maxLength={160}
                required
                disabled={pending}
              />
            )}
          </Field>
          <Field
            id="saved-line2"
            label="Apartment, suite or unit"
            error={state.errors?.["address.line2"]}
          >
            {(control) => (
              <Input
                {...control}
                name="line2"
                autoComplete="shipping address-line2"
                defaultValue={profile?.address_line2 ?? ""}
                maxLength={80}
                disabled={pending}
              />
            )}
          </Field>
          <Field
            id="saved-city"
            label="City"
            error={state.errors?.["address.city"]}
            required
          >
            {(control) => (
              <Select
                {...control}
                name="city"
                autoComplete="shipping address-level2"
                defaultValue={profile?.city ?? ""}
                required
                disabled={pending}
              >
                <option value="" disabled>
                  Choose a city
                </option>
                <option>Toronto</option>
                <option>Markham</option>
                <option>Mississauga</option>
              </Select>
            )}
          </Field>
          <Field
            id="saved-postal"
            label="Postal code"
            error={state.errors?.["address.postalCode"]}
            required
          >
            {(control) => (
              <Input
                {...control}
                name="postalCode"
                autoComplete="shipping postal-code"
                defaultValue={profile?.postal_code ?? ""}
                maxLength={10}
                required
                disabled={pending}
              />
            )}
          </Field>
          <Field id="saved-province" label="Province">
            {(control) => (
              <Select {...control} value="ON" disabled>
                <option value="ON">Ontario</option>
              </Select>
            )}
          </Field>
          <Field
            id="saved-instructions"
            label="Delivery instructions"
            description="Optional buzzer number or safe meeting directions."
            error={state.errors?.instructions}
            className="sm:col-span-2"
          >
            {(control) => (
              <Textarea
                {...control}
                name="instructions"
                defaultValue={profile?.delivery_instructions ?? ""}
                maxLength={500}
                disabled={pending}
              />
            )}
          </Field>
        </div>
        <Button
          type="submit"
          size="lg"
          disabled={pending}
          isLoading={pending}
          loadingLabel="Saving details…"
          className="w-full sm:w-fit"
        >
          Save details
        </Button>
      </form>
      {profile ? (
        <form
          action={removeCustomerDetails}
          className="border-border border-t pt-5"
        >
          <p className="text-ink-soft mb-3 max-w-xl text-sm leading-6">
            You can remove these saved details at any time. This does not erase
            information already recorded on paid orders.
          </p>
          <Button type="submit" variant="secondary">
            Remove saved details
          </Button>
        </form>
      ) : null}
    </div>
  );
}
