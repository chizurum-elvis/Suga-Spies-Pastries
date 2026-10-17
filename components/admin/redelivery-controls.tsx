"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  initialOrderActionState,
  type OrderActionState,
} from "@/lib/orders/action-state";
import { formatBusinessDateTime, formatCurrency } from "@/lib/i18n/format";
import { formatLocalDateLabel } from "@/lib/fulfillment/rules";
import type { RedeliveryRow } from "@/lib/payments/database";
import type { OrderView } from "@/lib/payments/schema";

type Action = (
  state: OrderActionState,
  data: FormData,
) => Promise<OrderActionState>;

function ActionMessage({ state }: { state: OrderActionState }) {
  if (!state.message) return null;
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={`text-sm ${state.status === "error" ? "text-critical-ink" : "text-sage-ink"}`}
    >
      {state.message}
    </p>
  );
}

export function RedeliveryAdminControls({
  order,
  redelivery,
  onFailure,
  onDate,
  onOutcome,
}: {
  order: OrderView;
  redelivery: RedeliveryRow | null;
  onFailure: Action;
  onDate: Action;
  onOutcome: Action;
}) {
  const router = useRouter();
  const [failureState, failureAction, failurePending] = useActionState(
    onFailure,
    initialOrderActionState,
  );
  const [dateState, dateAction, datePending] = useActionState(
    onDate,
    initialOrderActionState,
  );
  const [outcomeState, outcomeAction, outcomePending] = useActionState(
    onOutcome,
    initialOrderActionState,
  );
  useEffect(() => {
    const successes = [failureState, dateState, outcomeState].filter(
      (item) => item.status === "success" && item.submissionId,
    );
    if (!successes.length) return;
    toast.success("Delivery updated");
    router.refresh();
  }, [failureState, dateState, outcomeState, router]);

  if (order.fulfillmentStatus === "out_for_delivery" && !redelivery)
    return (
      <section aria-labelledby="failed-delivery-heading" className="space-y-4">
        <h2 id="failed-delivery-heading" className="text-lg font-bold">
          Could not deliver?
        </h2>
        <p className="text-ink-soft text-sm leading-6">
          Record a genuine failed attempt. The customer will have 24 hours to
          confirm or correct the address.
        </p>
        <form action={failureAction} className="grid gap-4">
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="expectedVersion" value={order.version} />
          <label className="text-sm font-semibold">
            Who caused this attempt to fail?
            <select
              name="fault"
              defaultValue="customer"
              className="border-border mt-2 min-h-11 w-full rounded-md border bg-white px-3"
            >
              <option value="customer">Customer / address issue</option>
              <option value="business">
                Our delivery issue — redelivery will be free
              </option>
            </select>
          </label>
          <label className="text-sm font-semibold">
            Private reason
            <textarea
              name="reason"
              required
              minLength={3}
              maxLength={500}
              rows={3}
              className="border-border mt-2 w-full rounded-md border bg-white p-3"
            />
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input
              name="confirmed"
              type="checkbox"
              value="yes"
              required
              className="mt-1 size-4"
            />
            I confirm a real delivery attempt was made and could not be
            completed.
          </label>
          <ActionMessage state={failureState} />
          <Button
            type="submit"
            isLoading={failurePending}
            loadingLabel="Recording attempt…"
          >
            Mark delivery attempt as failed
          </Button>
        </form>
      </section>
    );
  if (!redelivery) return null;
  const address = order.redelivery?.requestedAddress;
  return (
    <section aria-labelledby="redelivery-owner-heading" className="space-y-4">
      <h2 id="redelivery-owner-heading" className="text-lg font-bold">
        Redelivery
      </h2>
      <p className="text-ink-soft text-sm">
        First attempt failed {formatBusinessDateTime(redelivery.failed_at)} ·{" "}
        {redelivery.fault === "business"
          ? "Business issue"
          : "Customer/address issue"}
      </p>
      <p className="text-ink-soft text-sm break-words">
        Private reason: {redelivery.failure_reason}
      </p>
      {redelivery.state === "awaiting_customer" ? (
        <p className="text-ink-soft text-sm">
          Waiting for customer address confirmation until{" "}
          {formatBusinessDateTime(redelivery.respond_by)}. If they do not
          respond, the worker will close the order and initiate a full refund.
        </p>
      ) : null}
      {address ? (
        <address className="border-border border-t pt-4 text-sm leading-6 not-italic">
          <span className="font-semibold">Confirmed new address</span>
          <br />
          {address.line1}
          {address.line2 ? `, ${address.line2}` : ""}
          <br />
          {address.city}, ON {address.postalCode}
        </address>
      ) : null}
      {redelivery.fee_cents !== null ? (
        <p className="text-sm font-semibold">
          Additional fee:{" "}
          {redelivery.fee_cents
            ? `${formatCurrency(redelivery.fee_cents / 100)} CAD`
            : "Free"}
        </p>
      ) : null}
      {redelivery.selected_date ? (
        <p className="text-sm">
          Selected date:{" "}
          <strong>{formatLocalDateLabel(redelivery.selected_date)}</strong>
        </p>
      ) : null}
      {redelivery.state === "awaiting_owner" ||
      (redelivery.state === "awaiting_payment" &&
        !redelivery.payment_expires_at) ? (
        <form
          action={dateAction}
          className="border-border grid gap-4 border-t pt-4"
        >
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="expectedVersion" value={order.version} />
          <label className="text-sm font-semibold">
            Choose redelivery date
            <input
              type="date"
              name="date"
              required
              className="border-border mt-2 min-h-11 w-full rounded-md border bg-white px-3"
            />
          </label>
          <p className="text-ink-soft text-xs leading-5">
            Choose an open date after today. Free redelivery takes one of the
            four daily spaces immediately. Paid redelivery holds a space for 15
            minutes when the customer starts payment.
          </p>
          <ActionMessage state={dateState} />
          <Button
            type="submit"
            isLoading={datePending}
            loadingLabel="Checking date…"
          >
            Save date
          </Button>
        </form>
      ) : null}
      {redelivery.state === "awaiting_payment" &&
      redelivery.payment_expires_at ? (
        <p className="text-ink-soft text-sm">
          Waiting for payment confirmation. Capacity is reserved until{" "}
          {formatBusinessDateTime(redelivery.payment_expires_at)}. Do not send
          the order out until it is confirmed.
        </p>
      ) : null}
      {redelivery.state === "awaiting_payment" &&
      !redelivery.payment_expires_at ? (
        <p className="text-ink-soft text-sm">
          Customer payment is required before this date becomes confirmed.
        </p>
      ) : null}
      {redelivery.state === "scheduled" ? (
        <form
          action={outcomeAction}
          className="border-border grid gap-3 border-t pt-4"
        >
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="expectedVersion" value={order.version} />
          <input type="hidden" name="outcome" value="out_for_delivery" />
          <label className="flex items-start gap-3 text-sm">
            <input
              name="confirmed"
              type="checkbox"
              value="yes"
              required
              className="mt-1 size-4"
            />
            The order is leaving for the confirmed address on its scheduled
            date.
          </label>
          <ActionMessage state={outcomeState} />
          <Button
            type="submit"
            isLoading={outcomePending}
            loadingLabel="Updating…"
          >
            Mark out for redelivery
          </Button>
        </form>
      ) : null}
      {redelivery.state === "out_for_delivery" ? (
        <div className="border-border grid gap-5 border-t pt-4 sm:grid-cols-2">
          {[
            {
              outcome: "delivered",
              text: "Confirm delivered",
              hint: "The recipient received the pastries.",
            },
            {
              outcome: "failed",
              text: "Second attempt failed",
              hint: "This closes the order and starts full refunds for the order and any paid extra fee.",
            },
          ].map((item) => (
            <form
              action={outcomeAction}
              key={item.outcome}
              className="grid content-start gap-3"
            >
              <input type="hidden" name="orderId" value={order.id} />
              <input
                type="hidden"
                name="expectedVersion"
                value={order.version}
              />
              <input type="hidden" name="outcome" value={item.outcome} />
              <p className="text-ink-soft text-sm leading-5">{item.hint}</p>
              <label className="flex items-start gap-3 text-sm">
                <input
                  name="confirmed"
                  type="checkbox"
                  value="yes"
                  required
                  className="mt-1 size-4"
                />
                I confirm this outcome.
              </label>
              <Button
                type="submit"
                variant={item.outcome === "failed" ? "destructive" : "primary"}
                isLoading={outcomePending}
                loadingLabel="Updating…"
              >
                {item.text}
              </Button>
            </form>
          ))}
          <div className="sm:col-span-2">
            <ActionMessage state={outcomeState} />
          </div>
        </div>
      ) : null}
      {redelivery.state === "payment_review" ? (
        <p className="text-critical-ink text-sm">
          Payment needs manual review. Do not try to send or recharge this order
          until Stripe is reconciled.
        </p>
      ) : null}
      {redelivery.state === "discarded" ? (
        <p className="text-ink-soft text-sm">
          Order closed. Check both original-payment and redelivery-fee refund
          records below.
        </p>
      ) : null}
    </section>
  );
}
