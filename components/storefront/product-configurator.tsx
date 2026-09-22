"use client";

import { useMemo, useRef, useState } from "react";
import { Minus, Plus, ShoppingBag } from "lucide-react";

import { useCart } from "@/components/cart/cart-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { formatCents } from "@/lib/catalog/presentation";
import type {
  CatalogueOptionGroup,
  CatalogueProduct,
} from "@/lib/catalog/types";
import { configureProductLine } from "@/lib/cart/configuration";
import {
  coerceQuantityToRule,
  nextQuantity,
  previousQuantity,
  resolveQuantityRule,
} from "@/lib/cart/quantity";
import type { RawCartOptionSelection } from "@/lib/cart/types";
import { cn } from "@/lib/utils/cn";

function initialVariantId(product: CatalogueProduct) {
  const available = product.variants.filter((variant) => variant.isAvailable);
  return (
    available.find((variant) => variant.isDefault)?.id ??
    (available.length === 1 ? available[0]!.id : null)
  );
}

function optionSelectionArray(selection: Record<string, number>) {
  return Object.entries(selection)
    .filter(([, quantity]) => quantity > 0)
    .map(([optionValueId, quantity]): RawCartOptionSelection => ({
      optionValueId,
      quantity,
    }));
}

function groupSelectionCount(
  group: CatalogueOptionGroup,
  selections: Record<string, number>,
) {
  return group.values.reduce(
    (total, value) =>
      total +
      (group.selectionType === "quantity"
        ? (selections[value.id] ?? 0)
        : selections[value.id]
          ? 1
          : 0),
    0,
  );
}

export function ProductConfigurator({
  product,
}: {
  product: CatalogueProduct;
}) {
  const { addLine } = useCart();
  const [variantId, setVariantId] = useState<string | null>(() =>
    initialVariantId(product),
  );
  const initialVariant =
    product.variants.find((variant) => variant.id === variantId) ?? null;
  const [quantity, setQuantity] = useState(
    resolveQuantityRule(product, initialVariant).minimum,
  );
  const [quantityInput, setQuantityInput] = useState(String(quantity));
  const [selections, setSelections] = useState<Record<string, number>>({});
  const [attempted, setAttempted] = useState(false);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  const configured = useMemo(
    () =>
      configureProductLine(product, {
        variantId,
        optionSelections: optionSelectionArray(selections),
        quantity,
      }),
    [product, quantity, selections, variantId],
  );
  const rule = configured.quantityRule;
  const maximum = rule.maximum ?? 10_000;
  const configurationIssues = configured.issues.filter(
    (issue) => issue.code !== "product_unavailable",
  );

  const commitQuantity = (next: number) => {
    if (!Number.isInteger(next)) {
      setQuantityInput(String(quantity));
      return;
    }
    const safe = Math.min(10_000, Math.max(1, next));
    setQuantity(safe);
    setQuantityInput(String(safe));
  };

  const chooseVariant = (nextVariantId: string) => {
    const variant =
      product.variants.find((candidate) => candidate.id === nextVariantId) ??
      null;
    const nextRule = resolveQuantityRule(product, variant);
    const nextQuantity = coerceQuantityToRule(quantity, nextRule);
    setVariantId(nextVariantId);
    setQuantity(nextQuantity);
    setQuantityInput(String(nextQuantity));
  };

  const chooseSingle = (group: CatalogueOptionGroup, valueId: string | null) =>
    setSelections((current) => {
      const next = { ...current };
      group.values.forEach((value) => delete next[value.id]);
      if (valueId) next[valueId] = 1;
      return next;
    });

  const toggleMultiple = (valueId: string, checked: boolean) =>
    setSelections((current) => {
      const next = { ...current };
      if (checked) next[valueId] = 1;
      else delete next[valueId];
      return next;
    });

  const updateOptionQuantity = (
    group: CatalogueOptionGroup,
    valueId: string,
    change: -1 | 1,
  ) =>
    setSelections((current) => {
      const next = { ...current };
      const currentValue = next[valueId] ?? 0;
      const groupTotal = groupSelectionCount(group, current);
      if (
        change > 0 &&
        group.maximumSelections !== null &&
        groupTotal >= group.maximumSelections
      ) {
        return current;
      }
      const nextValue = Math.max(0, currentValue + change);
      if (nextValue === 0) delete next[valueId];
      else next[valueId] = nextValue;
      return next;
    });

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pendingRef.current) return;
    setAttempted(true);
    if (configured.issues.length || configured.lineSubtotalCents === null) {
      window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }

    pendingRef.current = true;
    setPending(true);
    try {
      const added = await addLine({
        line: configured.line,
        maximumQuantity: configured.quantityRule.maximum,
        productName: product.name,
        expectation:
          configured.pricingFingerprint && configured.lineSubtotalCents !== null
            ? {
                pricingFingerprint: configured.pricingFingerprint,
                lineSubtotalCents: configured.lineSubtotalCents,
              }
            : null,
      });
      if (added) setAttempted(false);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="border-border bg-surface-raised rounded-xl border p-5 shadow-[0_16px_45px_rgb(91_34_77_/_8%)] sm:p-6"
      noValidate
    >
      {attempted && configurationIssues.length ? (
        <div
          ref={errorSummaryRef}
          tabIndex={-1}
          className="bg-critical/65 text-critical-ink focus-visible:ring-critical-ink/30 mb-6 rounded-md px-4 py-3 outline-none focus-visible:ring-3"
          role="alert"
        >
          <p className="text-sm font-bold">Review your pastry choices.</p>
          <ul className="mt-1 grid gap-1 text-sm leading-6">
            {configurationIssues.map((issue, index) => (
              <li key={`${issue.code}-${index}`}>{issue.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {product.variants.length ? (
        <fieldset className="grid gap-3" disabled={!product.isAvailable}>
          <legend className="text-ink text-base font-semibold">
            Choose a size or style
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {product.variants.map((variant) => {
              const selected = variantId === variant.id;
              return (
                <label
                  key={variant.id}
                  className={cn(
                    "border-border bg-surface relative grid min-h-20 gap-1 rounded-lg border p-4 transition-colors",
                    variant.isAvailable
                      ? "hover:border-brand/60"
                      : "cursor-not-allowed opacity-55",
                    selected && "border-brand ring-brand/15 ring-3",
                  )}
                >
                  <input
                    type="radio"
                    name="product-variant"
                    value={variant.id}
                    checked={selected}
                    onChange={() => chooseVariant(variant.id)}
                    disabled={!variant.isAvailable}
                    className="accent-brand absolute top-4 right-4 size-4"
                  />
                  <span className="pr-6 text-sm font-semibold">
                    {variant.name}
                  </span>
                  <span className="text-ink-soft text-xs">
                    {variant.priceCents === null
                      ? "Uses the base price"
                      : formatCents(variant.priceCents)}
                  </span>
                  {!variant.isAvailable ? (
                    <span className="text-warning-ink text-xs font-bold">
                      Unavailable
                    </span>
                  ) : null}
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {product.optionGroups.map((group) => {
        const count = groupSelectionCount(group, selections);
        const groupErrors = attempted
          ? configurationIssues.filter(
              (issue) => issue.optionGroupId === group.id,
            )
          : [];
        const describedBy = groupErrors.length
          ? `${group.id}-error`
          : undefined;

        return (
          <fieldset
            key={group.id}
            className="border-border mt-6 grid gap-3 border-t pt-6"
            disabled={!product.isAvailable}
            aria-describedby={describedBy}
          >
            <legend className="w-full pt-6">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-ink text-base font-semibold">
                  {group.name}
                </span>
                <Badge>{group.isRequired ? "Required" : "Optional"}</Badge>
              </span>
              <span className="text-ink-soft mt-1 block text-xs leading-5 font-normal">
                {group.selectionType === "quantity"
                  ? `${count} selected${group.minimumSelections ? ` · minimum ${group.minimumSelections}` : ""}${group.maximumSelections !== null ? ` · maximum ${group.maximumSelections}` : ""}`
                  : group.maximumSelections !== null
                    ? `Choose up to ${group.maximumSelections}.`
                    : "Choose the options you would like."}
              </span>
            </legend>

            {groupErrors.length ? (
              <p
                id={`${group.id}-error`}
                className="text-critical-ink text-sm font-semibold"
              >
                {groupErrors[0]!.message}
              </p>
            ) : null}

            {group.selectionType === "single" ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {!group.isRequired ? (
                  <label className="border-border bg-surface flex min-h-14 items-center gap-3 rounded-lg border p-3 text-sm font-semibold">
                    <input
                      type="radio"
                      name={`group-${group.id}`}
                      checked={count === 0}
                      onChange={() => chooseSingle(group, null)}
                      className="accent-brand size-4"
                    />
                    No selection
                  </label>
                ) : null}
                {group.values.map((value) => (
                  <label
                    key={value.id}
                    className={cn(
                      "border-border bg-surface flex min-h-14 items-center gap-3 rounded-lg border p-3 text-sm",
                      !value.isAvailable && "cursor-not-allowed opacity-55",
                      selections[value.id] &&
                        "border-brand ring-brand/15 ring-3",
                    )}
                  >
                    <input
                      type="radio"
                      name={`group-${group.id}`}
                      checked={Boolean(selections[value.id])}
                      onChange={() => chooseSingle(group, value.id)}
                      disabled={!value.isAvailable}
                      className="accent-brand size-4 shrink-0"
                    />
                    <span className="min-w-0">
                      <span className="block font-semibold">{value.name}</span>
                      <span className="text-ink-soft text-xs">
                        {value.priceDeltaCents
                          ? `+${formatCents(value.priceDeltaCents)} each`
                          : "Included"}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            ) : group.selectionType === "multiple" ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {group.values.map((value) => {
                  const selected = Boolean(selections[value.id]);
                  const atMaximum =
                    group.maximumSelections !== null &&
                    count >= group.maximumSelections;
                  return (
                    <label
                      key={value.id}
                      className={cn(
                        "border-border bg-surface flex min-h-14 items-center gap-3 rounded-lg border p-3 text-sm",
                        (!value.isAvailable || (!selected && atMaximum)) &&
                          "cursor-not-allowed opacity-55",
                        selected && "border-brand ring-brand/15 ring-3",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(event) =>
                          toggleMultiple(value.id, event.target.checked)
                        }
                        disabled={
                          !value.isAvailable || (!selected && atMaximum)
                        }
                        className="accent-brand size-4 shrink-0"
                      />
                      <span className="min-w-0">
                        <span className="block font-semibold">
                          {value.name}
                        </span>
                        <span className="text-ink-soft text-xs">
                          {value.priceDeltaCents
                            ? `+${formatCents(value.priceDeltaCents)} each`
                            : "Included"}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="grid gap-2">
                {group.values.map((value) => {
                  const valueQuantity = selections[value.id] ?? 0;
                  const atMaximum =
                    group.maximumSelections !== null &&
                    count >= group.maximumSelections;
                  return (
                    <div
                      key={value.id}
                      className={cn(
                        "border-border bg-surface flex min-h-16 items-center justify-between gap-3 rounded-lg border p-3",
                        !value.isAvailable && "opacity-55",
                      )}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{value.name}</p>
                        <p className="text-ink-soft text-xs">
                          {value.priceDeltaCents
                            ? `+${formatCents(value.priceDeltaCents)} per selected piece`
                            : "Included"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="quiet"
                          size="icon"
                          className="size-10 min-h-10"
                          onClick={() =>
                            updateOptionQuantity(group, value.id, -1)
                          }
                          disabled={!value.isAvailable || valueQuantity === 0}
                          aria-label={`Decrease ${value.name} quantity`}
                        >
                          <Minus className="size-3.5" aria-hidden="true" />
                        </Button>
                        <output
                          className="min-w-7 text-center text-sm font-bold tabular-nums"
                          aria-live="polite"
                        >
                          {valueQuantity}
                        </output>
                        <Button
                          variant="quiet"
                          size="icon"
                          className="size-10 min-h-10"
                          onClick={() =>
                            updateOptionQuantity(group, value.id, 1)
                          }
                          disabled={!value.isAvailable || atMaximum}
                          aria-label={`Increase ${value.name} quantity`}
                        >
                          <Plus className="size-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </fieldset>
        );
      })}

      <div
        className={cn(
          product.variants.length || product.optionGroups.length
            ? "border-border mt-6 border-t pt-6"
            : "",
        )}
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <label
              htmlFor="product-quantity"
              className="text-ink text-sm font-semibold"
            >
              Quantity
            </label>
            <p className="text-ink-soft mt-1 text-xs">
              Minimum {rule.minimum}
              {rule.step > 1
                ? ` · steps of ${rule.step}`
                : " · add 1 at a time"}
              {rule.maximum !== null ? ` · maximum ${rule.maximum}` : ""}
            </p>
          </div>
          <div className="border-border-strong flex items-center rounded-md border bg-white">
            <Button
              variant="quiet"
              size="icon"
              onClick={() => commitQuantity(previousQuantity(quantity, rule))}
              disabled={quantity <= rule.minimum}
              aria-label={`Decrease quantity by ${rule.step}`}
            >
              <Minus className="size-4" aria-hidden="true" />
            </Button>
            <Input
              id="product-quantity"
              value={quantityInput}
              onChange={(event) => setQuantityInput(event.target.value)}
              onBlur={() => commitQuantity(Number(quantityInput))}
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
              className="min-h-11 w-16 rounded-none border-y-0 px-2 text-center text-sm font-bold tabular-nums focus-visible:relative"
              aria-invalid={
                attempted &&
                configured.issues.some((issue) =>
                  issue.code.startsWith("quantity_"),
                )
                  ? true
                  : undefined
              }
            />
            <Button
              variant="quiet"
              size="icon"
              onClick={() => commitQuantity(nextQuantity(quantity, rule))}
              disabled={quantity >= maximum}
              aria-label={`Increase quantity by ${rule.step}`}
            >
              <Plus className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="mt-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-ink-soft text-xs font-semibold">
              Current selection
            </p>
            <output className="text-ink mt-1 block text-xl font-bold tabular-nums">
              {configured.lineSubtotalCents === null
                ? "Price unavailable"
                : formatCents(configured.lineSubtotalCents)}
            </output>
          </div>
          <p className="text-ink-faint max-w-44 text-right text-[0.7rem] leading-5">
            The cart confirms current menu prices.
          </p>
        </div>

        <Button
          type="submit"
          className="mt-5 w-full"
          size="lg"
          disabled={!product.isAvailable}
          isLoading={pending}
          loadingLabel="Adding to your pastry box…"
        >
          <ShoppingBag className="size-4" aria-hidden="true" />
          {product.isAvailable
            ? `Add ${quantity} to cart`
            : "Temporarily unavailable"}
        </Button>
      </div>
    </form>
  );
}
