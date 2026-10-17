"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal, ModalClose } from "@/components/ui/modal";
import { formatBusinessDateTime, formatCurrency } from "@/lib/i18n/format";
import { cancellationEligibility } from "@/lib/orders/cancellation";
import type { FulfillmentStatus, OrderStatus } from "@/lib/orders/status";

export function CancellationControl({
  orderNumber,
  status,
  fulfillmentStatus,
  deadline,
  amountCents,
  owner = false,
  onConfirm,
}: {
  orderNumber: string;
  status: OrderStatus;
  fulfillmentStatus: FulfillmentStatus;
  deadline: string;
  amountCents: number;
  owner?: boolean;
  onConfirm: (reason: string) => Promise<string | null>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  const busy = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const eligibility = cancellationEligibility(
    { status, fulfillmentStatus, deadline },
    now,
  );
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  if (status === "cancelled") return null;
  return (
    <section
      className="border-border border-t pt-5"
      aria-label="Order cancellation"
    >
      <h2 className="text-base font-bold">Need to cancel?</h2>
      <p className="text-ink-soft mt-2 text-sm leading-6">
        {eligibility.eligible ? (
          <>
            Cancel before {formatBusinessDateTime(deadline)} for a full refund,
            provided preparation has not started.
          </>
        ) : (
          eligibility.reason
        )}
      </p>
      {eligibility.eligible || open ? (
        <Modal
          open={open}
          onOpenChange={(value) => {
            if (!busy.current) {
              setOpen(value);
              setError(null);
            }
          }}
          title="Cancel this order?"
          description={`${orderNumber} · Full refund of ${formatCurrency(amountCents / 100)} CAD`}
          trigger={
            <Button
              variant="secondary"
              className="mt-3"
              disabled={!eligibility.eligible}
            >
              Cancel order
            </Button>
          }
        >
          <form
            className="space-y-5"
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy.current) return;
              busy.current = true;
              setPending(true);
              setError(null);
              try {
                const problem = await onConfirm(reason.trim());
                if (problem) setError(problem);
                else setOpen(false);
              } catch {
                setError(
                  "We could not confirm cancellation. Refresh the order to check its status before retrying.",
                );
              } finally {
                busy.current = false;
                setPending(false);
              }
            }}
          >
            <p className="text-ink-soft text-sm leading-6">
              This cancels the entire pastry order and releases its delivery
              space. The refund includes the delivery fee and goes back to the
              original payment method. This cannot be undone.
            </p>
            {owner ? (
              <label className="grid gap-2 text-sm font-bold">
                Cancellation reason
                <textarea
                  className="border-border-strong bg-surface min-h-24 w-full rounded-md border p-3 text-sm font-normal"
                  required
                  minLength={3}
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={pending}
                />
                <span className="text-ink-soft text-xs font-normal">
                  For your private order records.
                </span>
              </label>
            ) : null}
            {error ? (
              <p
                ref={errorRef}
                tabIndex={-1}
                role="alert"
                className="text-critical-ink bg-critical rounded-md p-3 text-sm leading-6"
              >
                {error}
              </p>
            ) : null}
            {!eligibility.eligible ? (
              <p role="alert" className="text-critical-ink text-sm">
                {eligibility.reason}
              </p>
            ) : null}
            <div className="border-border flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-end">
              <ModalClose asChild>
                <Button variant="secondary" disabled={pending}>
                  Keep order
                </Button>
              </ModalClose>
              <Button
                type="submit"
                variant="destructive"
                isLoading={pending}
                disabled={!eligibility.eligible}
                loadingLabel="Cancelling…"
              >
                Cancel & refund {formatCurrency(amountCents / 100)}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </section>
  );
}
