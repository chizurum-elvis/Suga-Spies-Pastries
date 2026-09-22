"use client";

import { useActionState, useEffect } from "react";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";

import { CatalogueActionMessage } from "@/components/admin/catalogue-action-message";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import {
  initialCatalogueActionState,
  type CatalogueActionState,
} from "@/lib/catalog/action-state";
import type { AdminCategory, AdminProduct } from "@/lib/catalog/types";

type ProductAction = (
  state: CatalogueActionState,
  formData: FormData,
) => Promise<CatalogueActionState>;

export function ProductForm({
  action,
  categories,
  product,
}: {
  action: ProductAction;
  categories: AdminCategory[];
  product?: AdminProduct;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialCatalogueActionState,
  );
  const router = useRouter();
  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [router, state.submissionId, state.status]);

  return (
    <form action={formAction} className="grid gap-6" noValidate>
      <CatalogueActionMessage state={state} />
      {product ? (
        <>
          <input type="hidden" name="id" value={product.id} />
          <input type="hidden" name="version" value={product.version} />
        </>
      ) : null}

      <Card tone="admin" padding="lg">
        <h2 className="text-lg font-extrabold">Product identity</h2>
        <p className="text-ink-soft mt-1 text-sm leading-6">
          Use concise customer-facing wording. A published URL cannot be changed
          later.
        </p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Field
            id="product-name"
            label="Product name"
            error={state.errors?.name}
            required
          >
            {(props) => (
              <Input
                {...props}
                name="name"
                defaultValue={product?.name}
                maxLength={120}
                required
              />
            )}
          </Field>
          <Field
            id="product-slug"
            label="URL slug"
            description="Lowercase letters, numbers, and hyphens. Example: chocolate-chunk-cookies"
            error={state.errors?.slug}
            required
          >
            {(props) => (
              <Input
                {...props}
                name="slug"
                defaultValue={product?.slug}
                maxLength={120}
                readOnly={Boolean(product?.publishedAt)}
                required
              />
            )}
          </Field>
          <Field
            id="product-category"
            label="Category"
            error={state.errors?.categoryId}
            required
          >
            {(props) => (
              <Select
                {...props}
                name="categoryId"
                defaultValue={product?.categoryId ?? ""}
                required
              >
                <option value="" disabled>
                  Choose a category
                </option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field
            id="product-display-order"
            label="Homepage display order"
            description="Lower numbers appear first."
            error={state.errors?.displayOrder}
            required
          >
            {(props) => (
              <Input
                {...props}
                name="displayOrder"
                type="number"
                min={0}
                max={1000000}
                step={1}
                defaultValue={product?.displayOrder ?? 0}
                required
              />
            )}
          </Field>
        </div>
        <div className="mt-5 grid gap-5">
          <Field
            id="product-short-description"
            label="Short description"
            description="Used in summaries and search descriptions."
            error={state.errors?.shortDescription}
          >
            {(props) => (
              <Textarea
                {...props}
                name="shortDescription"
                defaultValue={product?.shortDescription ?? ""}
                maxLength={240}
                className="min-h-24"
              />
            )}
          </Field>
          <Field
            id="product-description"
            label="Full description"
            error={state.errors?.description}
          >
            {(props) => (
              <Textarea
                {...props}
                name="description"
                defaultValue={product?.description ?? ""}
                maxLength={4000}
              />
            )}
          </Field>
        </div>
      </Card>

      <Card tone="admin" padding="lg">
        <h2 className="text-lg font-extrabold">Price and quantity</h2>
        <p className="text-ink-soft mt-1 text-sm leading-6">
          All prices are Canadian dollars. The server converts them to exact
          integer cents.
        </p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            id="product-price"
            label="Base price (CAD)"
            error={state.errors?.price}
            required
          >
            {(props) => (
              <Input
                {...props}
                name="price"
                inputMode="decimal"
                defaultValue={
                  product ? (product.basePriceCents / 100).toFixed(2) : ""
                }
                placeholder="4.50"
                required
              />
            )}
          </Field>
          <Field
            id="product-unit"
            label="Unit label"
            description="For example: each or per box."
            error={state.errors?.unitLabel}
          >
            {(props) => (
              <Input
                {...props}
                name="unitLabel"
                defaultValue={product?.unitLabel ?? ""}
                maxLength={40}
              />
            )}
          </Field>
          <label className="border-border bg-canvas-strong flex min-h-20 items-center gap-3 self-end rounded-md border px-4 py-3 text-sm font-bold">
            <input
              name="isStartingPrice"
              type="checkbox"
              defaultChecked={product?.isStartingPrice ?? false}
              className="accent-brand size-4"
            />
            Show “From” before price
          </label>
          <Field
            id="minimum-quantity"
            label="Minimum quantity"
            error={state.errors?.minimumQuantity}
            required
          >
            {(props) => (
              <Input
                {...props}
                name="minimumQuantity"
                type="number"
                min={1}
                max={10000}
                step={1}
                defaultValue={product?.minimumQuantity ?? 1}
                required
              />
            )}
          </Field>
          <Field
            id="quantity-step"
            label="Quantity step"
            description="Use 1 when any quantity above the minimum is allowed."
            error={state.errors?.quantityStep}
            required
          >
            {(props) => (
              <Input
                {...props}
                name="quantityStep"
                type="number"
                min={1}
                max={10000}
                step={1}
                defaultValue={product?.quantityStep ?? 1}
                required
              />
            )}
          </Field>
          <Field
            id="maximum-quantity"
            label="Maximum quantity"
            description="Leave blank when there is no website maximum."
            error={state.errors?.maximumQuantity}
          >
            {(props) => (
              <Input
                {...props}
                name="maximumQuantity"
                type="number"
                min={1}
                max={10000}
                step={1}
                defaultValue={product?.maximumQuantity ?? ""}
              />
            )}
          </Field>
        </div>
      </Card>

      <Card tone="admin" padding="lg">
        <h2 className="text-lg font-extrabold">Food information</h2>
        <p className="text-ink-soft mt-1 text-sm leading-6">
          Publish only wording the owner has confirmed. Blank fields remain
          visibly unconfirmed to customers.
        </p>
        <div className="mt-6 grid gap-5">
          <Field
            id="product-ingredients"
            label="Ingredients"
            error={state.errors?.ingredients}
          >
            {(props) => (
              <Textarea
                {...props}
                name="ingredients"
                defaultValue={product?.ingredients ?? ""}
                maxLength={5000}
              />
            )}
          </Field>
          <Field
            id="product-allergens"
            label="Allergen and cross-contact wording"
            error={state.errors?.allergenInformation}
          >
            {(props) => (
              <Textarea
                {...props}
                name="allergenInformation"
                defaultValue={product?.allergenInformation ?? ""}
                maxLength={3000}
              />
            )}
          </Field>
          <Field
            id="product-instructions"
            label="Customer instructions"
            description="Storage, serving, or other product-specific guidance."
            error={state.errors?.customerInstructions}
          >
            {(props) => (
              <Textarea
                {...props}
                name="customerInstructions"
                defaultValue={product?.customerInstructions ?? ""}
                maxLength={2000}
              />
            )}
          </Field>
        </div>
      </Card>

      <div className="border-border bg-surface-raised sticky bottom-3 z-10 flex items-center justify-between gap-4 rounded-lg border p-3 shadow-lg">
        <p className="text-ink-soft hidden text-xs sm:block">
          Saving details does not automatically publish a draft.
        </p>
        <Button
          type="submit"
          size="lg"
          isLoading={pending}
          loadingLabel="Saving product…"
          className="w-full sm:ml-auto sm:w-auto"
        >
          <Save className="size-4" aria-hidden="true" />
          {product ? "Save changes" : "Create draft"}
        </Button>
      </div>
    </form>
  );
}
