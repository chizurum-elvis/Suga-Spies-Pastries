"use client";
import { useActionState } from "react";
import { updateCatalogueChoice } from "@/lib/catalog/actions";
import { initialCatalogueActionState } from "@/lib/catalog/action-state";
import { CatalogueActionMessage } from "@/components/admin/catalogue-action-message";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";

type Choice = {
  id: string;
  name: string;
  updatedAt?: string;
  priceCents?: number | null;
  priceDeltaCents?: number;
  minimumQuantity?: number | null;
  quantityStep?: number | null;
  maximumQuantity?: number | null;
  selectionType?: string;
  isRequired?: boolean;
};
export function ChoiceEditor({
  productId,
  itemType,
  choice,
  groupId,
}: {
  productId: string;
  itemType: "variant" | "option_group" | "option_value";
  choice: Choice;
  groupId?: string;
}) {
  const [state, action, pending] = useActionState(
    updateCatalogueChoice,
    initialCatalogueActionState,
  );
  return (
    <details className="mt-2 text-sm font-normal">
      <summary className="text-brand-strong min-h-11 cursor-pointer content-center font-bold">
        Edit {choice.name}
      </summary>
      <form action={action} className="border-border grid gap-3 border-t pt-3">
        <CatalogueActionMessage state={state} />
        <input type="hidden" name="productId" value={productId} />
        <input type="hidden" name="itemId" value={choice.id} />
        <input type="hidden" name="itemType" value={itemType} />
        <input type="hidden" name="updatedAt" value={choice.updatedAt ?? ""} />
        {groupId ? (
          <input type="hidden" name="optionGroupId" value={groupId} />
        ) : null}
        <label className="grid gap-1 text-xs font-bold">
          Name
          <Input
            name="name"
            defaultValue={choice.name}
            required
            maxLength={100}
          />
        </label>
        {itemType !== "option_group" ? (
          <label className="grid gap-1 text-xs font-bold">
            {itemType === "variant"
              ? "Price (CAD) · blank uses pastry price"
              : "Additional price (CAD)"}
            <Input
              name="price"
              inputMode="decimal"
              defaultValue={
                itemType === "variant"
                  ? choice.priceCents === null
                    ? ""
                    : ((choice.priceCents ?? 0) / 100).toFixed(2)
                  : ((choice.priceDeltaCents ?? 0) / 100).toFixed(2)
              }
              required={itemType === "option_value"}
            />
          </label>
        ) : null}
        {itemType === "variant" ? (
          <div className="grid gap-3">
            {[
              {
                name: "minimumQuantity",
                label: "Minimum",
                value: choice.minimumQuantity,
              },
              {
                name: "quantityStep",
                label: "Quantity increment",
                value: choice.quantityStep,
              },
              {
                name: "maximumQuantity",
                label: "Maximum",
                value: choice.maximumQuantity,
              },
            ].map((field) => (
              <label key={field.name} className="grid gap-1 text-xs font-bold">
                {field.label} · blank uses pastry rule
                <Input
                  name={field.name}
                  type="number"
                  min={1}
                  max={10000}
                  step={1}
                  defaultValue={field.value ?? ""}
                />
              </label>
            ))}
          </div>
        ) : null}
        {itemType === "option_group" ? (
          <>
            <label className="grid gap-1 text-xs font-bold">
              How customers choose
              <Select name="selectionType" defaultValue={choice.selectionType}>
                <option value="single">Choose one</option>
                <option value="multiple">Choose several</option>
                <option value="quantity">Mix quantities</option>
              </Select>
            </label>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                className="accent-brand size-4"
                type="checkbox"
                name="isRequired"
                defaultChecked={choice.isRequired}
              />
              Customer must choose
            </label>
          </>
        ) : null}
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          disabled={pending}
          isLoading={pending}
          loadingLabel="Saving…"
        >
          Save choice
        </Button>
      </form>
    </details>
  );
}
