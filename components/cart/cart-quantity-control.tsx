"use client";

import { useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";

import { useCart } from "@/components/cart/cart-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import {
  coerceQuantityToRule,
  nextQuantity,
  previousQuantity,
  quantityIssue,
} from "@/lib/cart/quantity";
import type { CartQuantityRule } from "@/lib/cart/types";

export function CartQuantityControl({
  lineId,
  productName,
  quantity,
  rule,
}: {
  lineId: string;
  productName: string;
  quantity: number;
  rule: CartQuantityRule;
}) {
  const { updateQuantity, validation } = useCart();
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const checking = pending || validation.status !== "ready";
  const issue = quantityIssue(quantity, rule);
  const correctedQuantity = coerceQuantityToRule(quantity, rule);
  const maximum = rule.maximum ?? 10_000;

  const commit = async (next: number) => {
    if (pendingRef.current || validation.status !== "ready") return;
    pendingRef.current = true;
    setPending(true);
    try {
      await updateQuantity(lineId, next);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  const commitInput = (input: HTMLInputElement) => {
    const value = Number(input.value);
    if (!Number.isInteger(value)) {
      input.value = String(quantity);
      return;
    }
    void commit(value);
  };

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-1.5">
        <Button
          variant="secondary"
          size="icon"
          className="size-11 min-h-11 aria-disabled:opacity-50"
          onClick={() => {
            if (quantity > rule.minimum)
              void commit(previousQuantity(quantity, rule));
          }}
          aria-disabled={checking || quantity <= rule.minimum}
          aria-label={`Decrease ${productName} quantity by ${rule.step}`}
        >
          <Minus className="size-3.5" aria-hidden="true" />
        </Button>
        <label>
          <span className="sr-only">{productName} quantity</span>
          <Input
            key={quantity}
            defaultValue={quantity}
            onBlur={(event) => commitInput(event.currentTarget)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
            type="number"
            inputMode="numeric"
            min={1}
            max={10_000}
            step={1}
            readOnly={checking}
            aria-busy={checking}
            className="h-11 min-h-11 w-14 px-2 text-center text-sm font-bold tabular-nums"
          />
        </label>
        <Button
          variant="secondary"
          size="icon"
          className="size-11 min-h-11 aria-disabled:opacity-50"
          onClick={() => {
            if (quantity < maximum) void commit(nextQuantity(quantity, rule));
          }}
          aria-disabled={checking || quantity >= maximum}
          aria-label={`Increase ${productName} quantity by ${rule.step}`}
        >
          <Plus className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
      {issue ? (
        <Button
          variant="quiet"
          size="sm"
          className="text-brand-strong min-h-10 justify-start px-0 text-xs"
          onClick={() => void commit(correctedQuantity)}
          disabled={pending}
        >
          Use valid quantity {correctedQuantity}
        </Button>
      ) : null}
    </div>
  );
}
