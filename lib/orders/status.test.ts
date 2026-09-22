import { describe, expect, it } from "vitest";

import {
  fulfillmentStages,
  fulfillmentTransitionSchema,
  nextFulfillmentStatus,
} from "@/lib/orders/status";

describe("order fulfilment lifecycle", () => {
  it("moves through every customer-visible stage without skipping", () => {
    expect(fulfillmentStages.map((stage) => stage.status)).toEqual([
      "received",
      "preparing",
      "ready",
      "out_for_delivery",
      "delivered",
    ]);
    expect(nextFulfillmentStatus("received")).toBe("preparing");
    expect(nextFulfillmentStatus("out_for_delivery")).toBe("delivered");
    expect(nextFulfillmentStatus("delivered")).toBeNull();
  });

  it.each([
    ["received", "ready"],
    ["preparing", "received"],
    ["ready", "delivered"],
    ["delivered", "delivered"],
  ])("rejects the invalid transition %s to %s", (from, to) => {
    expect(
      fulfillmentTransitionSchema.safeParse({
        orderId: "98000000-0000-4000-8000-000000000004",
        expectedStatus: from,
        nextStatus: to,
        expectedVersion: 1,
        idempotencyKey: "98000000-0000-4000-8000-000000000006",
      }).success,
    ).toBe(false);
  });

  it("accepts only the immediate next stage", () => {
    expect(
      fulfillmentTransitionSchema.safeParse({
        orderId: "98000000-0000-4000-8000-000000000004",
        expectedStatus: "ready",
        nextStatus: "out_for_delivery",
        expectedVersion: 3,
        idempotencyKey: "98000000-0000-4000-8000-000000000006",
      }).success,
    ).toBe(true);
  });
});
