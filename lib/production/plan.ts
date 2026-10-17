import { purchaseSnapshotSchema } from "@/lib/payments/schema";
import { externalItemSnapshotSchema } from "@/lib/production/external-schema";
import { z } from "zod";

export type ProductionOrder = {
  id: string;
  orderNumber: string;
  fulfillmentDate: string;
  fulfillmentStatus: string;
  snapshot: unknown;
  testOnly: boolean;
};

export type ProductionRedelivery = {
  orderId: string;
  selectedDate: string;
  state: string;
  paymentStatus: string;
};

export type ProductionLine = {
  key: string;
  name: string;
  variant: string | null;
  choices: { label: string; allocatedQuantity: number | null }[];
  quantity: number;
  orderNumbers: string[];
};

export type ProductionDay = {
  date: string;
  orderCount: number;
  pieceCount: number;
  lines: ProductionLine[];
  orders: {
    id: string;
    number: string;
    stage: string;
    redelivery: boolean;
    itemCount: number;
    testOnly: boolean;
  }[];
};

export type ExternalProductionOrder = {
  id: string;
  number: string;
  date: string;
  source: string;
  status: string;
  items: unknown;
};

export function buildExternalProductionPlan(
  orders: readonly ExternalProductionOrder[],
  from: string,
  to: string,
) {
  const days = new Map<
    string,
    {
      date: string;
      orders: ExternalProductionOrder[];
      lines: {
        name: string;
        note: string | null;
        quantity: number;
        orderNumbers: string[];
      }[];
      pieceCount: number;
    }
  >();
  for (const order of orders) {
    if (
      order.date < from ||
      order.date > to ||
      !activeOriginalStages.has(order.status)
    )
      continue;
    const items = z.array(externalItemSnapshotSchema).parse(order.items);
    const day = days.get(order.date) ?? {
      date: order.date,
      orders: [],
      lines: [],
      pieceCount: 0,
    };
    if (!days.has(order.date)) days.set(order.date, day);
    day.orders.push(order);
    for (const item of items) {
      const line = day.lines.find(
        (entry) => entry.name === item.name && entry.note === item.note,
      );
      if (line) {
        line.quantity += item.quantity;
        line.orderNumbers.push(order.number);
      } else {
        day.lines.push({
          name: item.name,
          note: item.note,
          quantity: item.quantity,
          orderNumbers: [order.number],
        });
      }
      day.pieceCount += item.quantity;
    }
  }
  return [...days.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day) => ({
      ...day,
      lines: day.lines.sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

const activeOriginalStages = new Set([
  "received",
  "preparing",
  "ready",
  "out_for_delivery",
]);

function choicesForLine(
  options: {
    groupName: string;
    name: string;
    quantity: number;
    selectionType: string;
  }[],
) {
  return options.map((option) => ({
    label: `${option.groupName}: ${option.name}`,
    allocatedQuantity:
      option.selectionType === "quantity" ? option.quantity : null,
  }));
}

export function buildProductionPlan(
  orders: readonly ProductionOrder[],
  redeliveries: readonly ProductionRedelivery[],
  from: string,
  to: string,
): ProductionDay[] {
  const redeliveryByOrder = new Map(
    redeliveries.map((redelivery) => [redelivery.orderId, redelivery]),
  );
  const days = new Map<string, ProductionDay>();

  for (const order of orders) {
    const redelivery = redeliveryByOrder.get(order.id);
    const scheduledAgain =
      redelivery &&
      ["scheduled", "out_for_delivery"].includes(redelivery.state) &&
      ["not_required", "paid"].includes(redelivery.paymentStatus);
    const originalActive = activeOriginalStages.has(order.fulfillmentStatus);
    const date = scheduledAgain
      ? redelivery.selectedDate
      : originalActive
        ? order.fulfillmentDate
        : null;
    if (!date || date < from || date > to) continue;

    // An immutable paid snapshot is the only source of production quantities.
    // A malformed snapshot must fail this private page rather than undercount food.
    const snapshot = purchaseSnapshotSchema.parse(order.snapshot);
    if (snapshot.validatedCart.status !== "ready") continue;

    const day = days.get(date) ?? {
      date,
      orderCount: 0,
      pieceCount: 0,
      lines: [],
      orders: [],
    };
    if (!days.has(date)) days.set(date, day);
    day.orderCount += 1;
    day.orders.push({
      id: order.id,
      number: order.orderNumber,
      stage: order.fulfillmentStatus,
      redelivery: Boolean(scheduledAgain),
      itemCount: snapshot.validatedCart.itemCount,
      testOnly: order.testOnly,
    });

    for (const line of snapshot.validatedCart.lines) {
      if (!line.product || line.status !== "ready")
        throw new Error("A paid order contains an incomplete pastry line.");
      const choices = choicesForLine(line.options);
      const key = JSON.stringify([
        line.lineId,
        line.product.name,
        line.variant?.name ?? null,
        choices.map((choice) => [choice.label, choice.allocatedQuantity]),
      ]);
      let grouped = day.lines.find((item) => item.key === key);
      if (!grouped) {
        grouped = {
          key,
          name: line.product.name,
          variant: line.variant?.name ?? null,
          choices: choices.map((choice) => ({
            ...choice,
            allocatedQuantity: choice.allocatedQuantity === null ? null : 0,
          })),
          quantity: 0,
          orderNumbers: [],
        };
        day.lines.push(grouped);
      }
      grouped.quantity += line.quantity;
      grouped.choices.forEach((choice, index) => {
        if (choice.allocatedQuantity !== null)
          choice.allocatedQuantity += choices[index]?.allocatedQuantity ?? 0;
      });
      grouped.orderNumbers.push(order.orderNumber);
      day.pieceCount += line.quantity;
    }
  }

  return [...days.values()]
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((day) => ({
      ...day,
      lines: day.lines.sort(
        (left, right) =>
          left.name.localeCompare(right.name) ||
          (left.variant ?? "").localeCompare(right.variant ?? ""),
      ),
      orders: day.orders.sort((left, right) =>
        left.number.localeCompare(right.number),
      ),
    }));
}
