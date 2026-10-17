import { describe, expect, it } from "vitest";

import {
  buildExternalProductionPlan,
  buildProductionPlan,
  type ProductionOrder,
} from "@/lib/production/plan";
import { purchaseFixture } from "@/tests/fixtures/payment";

function order(
  id: string,
  date = "2026-10-12",
  status = "received",
): ProductionOrder {
  return {
    id,
    orderNumber: `SS-${id}`,
    fulfillmentDate: date,
    fulfillmentStatus: status,
    snapshot: purchaseFixture(),
    testOnly: true,
  };
}

describe("owner production plan", () => {
  it("combines matching pastry configurations without changing paid snapshots", () => {
    const plan = buildProductionPlan(
      [order("one"), order("two", "2026-10-12", "preparing")],
      [],
      "2026-10-12",
      "2026-10-12",
    );
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ orderCount: 2, pieceCount: 8 });
    expect(plan[0]?.lines).toEqual([
      expect.objectContaining({
        name: "Chocolate Chip Cookies",
        quantity: 8,
        orderNumbers: ["SS-one", "SS-two"],
      }),
    ]);
  });

  it("puts a paid redelivery on its new date once, never on the old date", () => {
    const plan = buildProductionPlan(
      [order("one", "2026-10-12", "redelivery_scheduled")],
      [
        {
          orderId: "one",
          selectedDate: "2026-10-15",
          state: "scheduled",
          paymentStatus: "paid",
        },
      ],
      "2026-10-12",
      "2026-10-15",
    );
    expect(plan.map((day) => day.date)).toEqual(["2026-10-15"]);
    expect(plan[0]?.orders[0]?.redelivery).toBe(true);
  });

  it("does not count a redelivery awaiting payment or an inactive order", () => {
    const plan = buildProductionPlan(
      [
        order("one", "2026-10-12", "redelivery_scheduled"),
        order("two", "2026-10-12", "delivered"),
      ],
      [
        {
          orderId: "one",
          selectedDate: "2026-10-15",
          state: "awaiting_payment",
          paymentStatus: "pending",
        },
      ],
      "2026-10-12",
      "2026-10-15",
    );
    expect(plan).toEqual([]);
  });

  it("keeps variants and different choices as separate bake lines", () => {
    const first = order("one");
    const second = order("two");
    const changed = purchaseFixture();
    changed.validatedCart.lines[0].variant = {
      id: "40000000-0000-4000-8000-000000000001",
      name: "Vanilla",
    };
    changed.validatedCart.lines[0].variantId =
      "40000000-0000-4000-8000-000000000001";
    changed.cart.lines[0].variantId = "40000000-0000-4000-8000-000000000001";
    second.snapshot = changed;
    const plan = buildProductionPlan(
      [first, second],
      [],
      "2026-10-12",
      "2026-10-12",
    );
    expect(plan[0]?.lines).toHaveLength(2);
    expect(plan[0]?.pieceCount).toBe(8);
  });

  it("totals allocated flavours across boxes and accepts their paid surcharge", () => {
    const allocated = purchaseFixture();
    const optionValueId = "50000000-0000-4000-8000-000000000001";
    allocated.cart.lines[0].optionSelections = [{ optionValueId, quantity: 2 }];
    allocated.validatedCart.lines[0].optionSelections = [
      { optionValueId, quantity: 2 },
    ];
    allocated.validatedCart.lines[0].options = [
      {
        id: optionValueId,
        groupId: "50000000-0000-4000-8000-000000000002",
        groupName: "Flavours",
        name: "Vanilla",
        quantity: 2,
        priceDeltaCents: 50,
        selectionType: "quantity",
      },
    ];
    allocated.validatedCart.lines[0].lineSubtotalCents = 1100;
    allocated.validatedCart.subtotalCents = 1100;
    allocated.subtotalCents = 1100;
    allocated.totalCents = 1600;
    const first = order("one");
    const second = order("two");
    first.snapshot = allocated;
    second.snapshot = structuredClone(allocated);
    const plan = buildProductionPlan(
      [first, second],
      [],
      "2026-10-12",
      "2026-10-12",
    );
    expect(plan[0]?.lines[0]?.choices).toEqual([
      { label: "Flavours: Vanilla", allocatedQuantity: 4 },
    ]);
    expect(plan[0]?.pieceCount).toBe(8);
  });

  it("refuses a malformed paid snapshot instead of silently underproducing", () => {
    const bad = order("bad");
    bad.snapshot = { nonsense: true };
    expect(() =>
      buildProductionPlan([bad], [], "2026-10-12", "2026-10-12"),
    ).toThrow();
  });

  it("does not leave an original delivery on the old date when redelivery moved out of range", () => {
    const plan = buildProductionPlan(
      [order("one", "2026-10-12")],
      [
        {
          orderId: "one",
          selectedDate: "2026-11-01",
          state: "scheduled",
          paymentStatus: "paid",
        },
      ],
      "2026-10-12",
      "2026-10-12",
    );
    expect(plan).toEqual([]);
  });
});

describe("external preparation plan", () => {
  const item = {
    productId: "40000000-0000-4000-8000-000000000001",
    name: "Chocolate Chip Cookies",
    quantity: 4,
    note: null,
    baseUnitPriceCents: 250,
  };

  it("combines identical pastries and keeps custom notes separate", () => {
    const plan = buildExternalProductionPlan(
      [
        {
          id: "1",
          number: "EXT-1",
          date: "2026-10-12",
          source: "phone",
          status: "received",
          items: [item],
        },
        {
          id: "2",
          number: "EXT-2",
          date: "2026-10-12",
          source: "instagram",
          status: "preparing",
          items: [item, { ...item, note: "No nuts" }],
        },
      ],
      "2026-10-12",
      "2026-10-12",
    );
    expect(plan[0]?.pieceCount).toBe(12);
    expect(plan[0]?.lines).toEqual([
      expect.objectContaining({
        quantity: 8,
        note: null,
        orderNumbers: ["EXT-1", "EXT-2"],
      }),
      expect.objectContaining({ quantity: 4, note: "No nuts" }),
    ]);
  });

  it("excludes cancelled and delivered work and fails on a corrupted item snapshot", () => {
    expect(
      buildExternalProductionPlan(
        [
          {
            id: "1",
            number: "EXT-1",
            date: "2026-10-12",
            source: "phone",
            status: "cancelled",
            items: [item],
          },
          {
            id: "2",
            number: "EXT-2",
            date: "2026-10-12",
            source: "phone",
            status: "delivered",
            items: [item],
          },
        ],
        "2026-10-12",
        "2026-10-12",
      ),
    ).toEqual([]);
    expect(() =>
      buildExternalProductionPlan(
        [
          {
            id: "3",
            number: "EXT-3",
            date: "2026-10-12",
            source: "phone",
            status: "received",
            items: [{ ...item, quantity: -1 }],
          },
        ],
        "2026-10-12",
        "2026-10-12",
      ),
    ).toThrow();
  });
});
