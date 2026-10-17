import { RotateCcw } from "lucide-react";
import { formatBusinessDateTime, formatCurrency } from "@/lib/i18n/format";
import { refundMessage, type RefundView } from "@/lib/orders/cancellation";

export function RefundStatus({ refund }: { refund: RefundView }) {
  const attention =
    refund.status === "failed" || refund.status === "needs_review";
  return (
    <section
      aria-label="Refund status"
      className="border-border bg-brand-soft/30 rounded-md border p-5"
    >
      <div className="flex items-start gap-3">
        <RotateCcw
          className="text-brand mt-0.5 size-5 shrink-0"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <h2 className="text-base font-bold">
            {refund.status === "succeeded"
              ? "Full refund issued"
              : attention
                ? "Refund needs attention"
                : "Full refund processing"}
          </h2>
          <p className="text-brand-strong mt-1 text-lg font-bold">
            {formatCurrency(refund.amountCents / 100)} CAD
          </p>
          <p className="text-ink-soft mt-2 text-sm leading-6">
            {refundMessage(refund.status)}
          </p>
          <p className="text-ink-soft mt-3 text-xs">
            {refund.completedAt ? "Issued" : "Requested"}{" "}
            {formatBusinessDateTime(refund.completedAt ?? refund.requestedAt)}
          </p>
        </div>
      </div>
    </section>
  );
}
