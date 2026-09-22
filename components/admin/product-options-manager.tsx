"use client";

import { useActionState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import { CatalogueActionMessage } from "@/components/admin/catalogue-action-message";
import { NestedStateButton } from "@/components/admin/nested-state-button";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { formatCents } from "@/lib/catalog/presentation";
import {
  initialCatalogueActionState,
  type CatalogueActionState,
} from "@/lib/catalog/action-state";
import type {
  CatalogueOptionGroup,
  CatalogueVariant,
} from "@/lib/catalog/types";

type Action = (
  state: CatalogueActionState,
  data: FormData,
) => Promise<CatalogueActionState>;

function ConfigurationForm({
  action,
  children,
}: {
  action: Action;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialCatalogueActionState,
  );
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      router.refresh();
    }
  }, [router, state.submissionId, state.status]);
  return (
    <form ref={formRef} action={formAction} className="grid gap-4">
      <CatalogueActionMessage state={state} />
      {children}
      <Button
        type="submit"
        disabled={pending}
        isLoading={pending}
        loadingLabel="Adding…"
        className="justify-self-start"
      >
        <Plus className="size-4" aria-hidden="true" />
        Add
      </Button>
    </form>
  );
}

export function ProductOptionsManager({
  productId,
  variants,
  groups,
  createVariantAction,
  createGroupAction,
  createValueAction,
  changeStateAction,
}: {
  productId: string;
  variants: CatalogueVariant[];
  groups: CatalogueOptionGroup[];
  createVariantAction: Action;
  createGroupAction: Action;
  createValueAction: Action;
  changeStateAction: Action;
}) {
  return (
    <div className="grid gap-8">
      <section aria-labelledby="variants-admin-heading">
        <h3 id="variants-admin-heading" className="font-extrabold">
          Variants
        </h3>
        <p className="text-ink-soft mt-1 text-sm leading-6">
          Use variants only when a purchasable size or style has its own price
          or quantity rule.
        </p>
        {variants.length ? (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {variants.map((variant) => (
              <li
                key={variant.id}
                className="border-border bg-canvas-strong grid gap-3 rounded-md border p-3"
              >
                <div>
                  <p className="text-sm font-extrabold">{variant.name}</p>
                  <p className="text-ink-soft mt-1 text-xs">
                    {variant.priceCents === null
                      ? "Uses base price"
                      : formatCents(variant.priceCents)}{" "}
                    · {variant.isAvailable ? "Available" : "Unavailable"}
                    {variant.minimumQuantity
                      ? ` · minimum ${variant.minimumQuantity}`
                      : ""}
                    {variant.quantityStep
                      ? ` · step ${variant.quantityStep}`
                      : ""}
                  </p>
                </div>
                <NestedStateButton
                  action={changeStateAction}
                  productId={productId}
                  itemId={variant.id}
                  itemType="variant"
                  available={variant.isAvailable}
                  archived={variant.status === "archived"}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-faint mt-3 text-sm">No variants configured.</p>
        )}
        <div className="border-border mt-4 rounded-md border p-4">
          <ConfigurationForm action={createVariantAction}>
            <input type="hidden" name="productId" value={productId} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="variant-name" label="Variant name" required>
                {(props) => (
                  <Input {...props} name="name" maxLength={100} required />
                )}
              </Field>
              <Field
                id="variant-price"
                label="Price override (CAD)"
                description="Leave blank to use the base price."
              >
                {(props) => (
                  <Input
                    {...props}
                    name="price"
                    inputMode="decimal"
                    placeholder="45.00"
                  />
                )}
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field id="variant-minimum" label="Minimum override">
                {(props) => (
                  <Input
                    {...props}
                    name="minimumQuantity"
                    type="number"
                    min={1}
                    max={10000}
                    step={1}
                  />
                )}
              </Field>
              <Field id="variant-step" label="Step override">
                {(props) => (
                  <Input
                    {...props}
                    name="quantityStep"
                    type="number"
                    min={1}
                    max={10000}
                    step={1}
                  />
                )}
              </Field>
              <Field id="variant-maximum" label="Maximum override">
                {(props) => (
                  <Input
                    {...props}
                    name="maximumQuantity"
                    type="number"
                    min={1}
                    max={10000}
                    step={1}
                  />
                )}
              </Field>
            </div>
          </ConfigurationForm>
        </div>
      </section>

      <section
        className="border-border border-t pt-7"
        aria-labelledby="options-admin-heading"
      >
        <h3 id="options-admin-heading" className="font-extrabold">
          Flavours and customizations
        </h3>
        <p className="text-ink-soft mt-1 text-sm leading-6">
          Group related choices such as flavour, decoration, topping, or message
          style.
        </p>
        {groups.length ? (
          <div className="mt-4 grid gap-3">
            {groups.map((group) => (
              <div
                key={group.id}
                className="border-border bg-canvas-strong rounded-md border p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-extrabold">{group.name}</p>
                  <span className="text-ink-faint text-xs font-bold">
                    {group.selectionType} ·{" "}
                    {group.isRequired ? "required" : "optional"}
                  </span>
                </div>
                <div className="mt-2">
                  <NestedStateButton
                    action={changeStateAction}
                    productId={productId}
                    itemId={group.id}
                    itemType="option_group"
                    archived={group.status === "archived"}
                  />
                </div>
                {group.values.length ? (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {group.values.map((value) => (
                      <li
                        key={value.id}
                        className="bg-surface border-border grid gap-1 rounded-md border px-3 py-2 text-xs font-bold"
                      >
                        <span>
                          {value.name}
                          {value.priceDeltaCents
                            ? ` +${formatCents(value.priceDeltaCents)}`
                            : ""}
                        </span>
                        <NestedStateButton
                          action={changeStateAction}
                          productId={productId}
                          itemId={value.id}
                          itemType="option_value"
                          available={value.isAvailable}
                          archived={value.status === "archived"}
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-ink-faint mt-2 text-xs">
                    No choices in this group yet.
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-ink-faint mt-3 text-sm">
            No customization groups configured.
          </p>
        )}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="border-border rounded-md border p-4">
            <h4 className="mb-4 text-sm font-extrabold">Add an option group</h4>
            <ConfigurationForm action={createGroupAction}>
              <input type="hidden" name="productId" value={productId} />
              <Field id="group-name" label="Group name" required>
                {(props) => (
                  <Input {...props} name="name" maxLength={100} required />
                )}
              </Field>
              <Field id="selection-type" label="How customers choose" required>
                {(props) => (
                  <Select {...props} name="selectionType" defaultValue="single">
                    <option value="single">Choose one</option>
                    <option value="multiple">Choose several</option>
                    <option value="quantity">Choose quantities</option>
                  </Select>
                )}
              </Field>
              <label className="flex items-center gap-3 text-sm font-bold">
                <input
                  type="checkbox"
                  name="isRequired"
                  className="accent-brand size-4"
                />
                Customer must choose
              </label>
            </ConfigurationForm>
          </div>
          <div className="border-border rounded-md border p-4">
            <h4 className="mb-4 text-sm font-extrabold">Add a choice</h4>
            {groups.length ? (
              <ConfigurationForm action={createValueAction}>
                <Field id="option-group-id" label="Option group" required>
                  {(props) => (
                    <Select
                      {...props}
                      name="optionGroupId"
                      defaultValue={groups[0]?.id}
                    >
                      {groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field id="option-value-name" label="Choice name" required>
                  {(props) => (
                    <Input {...props} name="name" maxLength={100} required />
                  )}
                </Field>
                <Field
                  id="option-value-price"
                  label="Additional price (CAD)"
                  description="Enter 0 when included."
                  required
                >
                  {(props) => (
                    <Input
                      {...props}
                      name="price"
                      defaultValue="0.00"
                      inputMode="decimal"
                      required
                    />
                  )}
                </Field>
              </ConfigurationForm>
            ) : (
              <p className="text-ink-soft text-sm">
                Add an option group first.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
