import { describe, expect, it } from "vitest";
import {
  cancellationEligibility,
  cancellationInputSchema,
} from "@/lib/orders/cancellation";
import { deliveryCancellationDeadline } from "@/lib/fulfillment/rules";

describe("cancellation policy", () => {
  const order = {
    status: "confirmed" as const,
    fulfillmentStatus: "received" as const,
    deadline: "2026-10-11T04:00:00.000Z",
  };
  it("allows cancellation the day after purchase when the delivery deadline has not passed", () => {
    expect(
      cancellationEligibility(order, Date.parse("2026-10-05T16:00:00Z"))
        .eligible,
    ).toBe(true);
  });
  it.each([
    [-1, true],
    [0, false],
    [1, false],
  ])("checks the boundary at %s milliseconds", (offset, allowed) => {
    expect(
      cancellationEligibility(order, Date.parse(order.deadline) + offset)
        .eligible,
    ).toBe(allowed);
  });
  it.each(["preparing", "ready", "out_for_delivery", "delivered"] as const)(
    "rejects %s even with plenty of notice",
    (fulfillmentStatus) => {
      expect(
        cancellationEligibility({ ...order, fulfillmentStatus }, 0).eligible,
      ).toBe(false);
    },
  );
  it.each(["completed", "cancelled"] as const)(
    "rejects a %s order",
    (status) => {
      expect(cancellationEligibility({ ...order, status }, 0).eligible).toBe(
        false,
      );
    },
  );
  it("fails closed for a malformed deadline", () =>
    expect(
      cancellationEligibility({ ...order, deadline: "invalid" }, 0).eligible,
    ).toBe(false));
  it.each([
    ["2026-03-09", "2026-03-08T05:00:00.000Z"],
    ["2026-11-02", "2026-11-01T04:00:00.000Z"],
  ])(
    "uses the promised Toronto calendar cutoff across DST for %s",
    (day, deadline) => {
      expect(deliveryCancellationDeadline(day).toISOString()).toBe(deadline);
      expect(
        cancellationEligibility({ ...order, deadline }, Date.parse(deadline))
          .eligible,
      ).toBe(false);
    },
  );
  it.each([
    { expectedVersion: 1, confirmed: false },
    { expectedVersion: 0, confirmed: true },
    { expectedVersion: 1.1, confirmed: true },
    { expectedVersion: 1, confirmed: true, amount: 1 },
    { expectedVersion: 1, confirmed: true, eligible: true },
    { expectedVersion: 1, confirmed: true, paymentIntent: "pi_other" },
  ])("rejects an invalid or tampered request %j", (input) => {
    expect(cancellationInputSchema.safeParse(input).success).toBe(false);
  });
});
