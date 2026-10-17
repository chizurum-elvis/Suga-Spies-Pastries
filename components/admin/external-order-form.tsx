"use client";

import { useActionState, useEffect, useState } from "react";
import { AdminLink as Link } from "@/components/navigation/admin-link";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import {
  createExternalOrder,
  type ExternalActionState,
} from "@/lib/production/external-actions";

type ProductChoice = {
  id: string;
  name: string;
  minimumQuantity: number;
  quantityStep: number;
  maximumQuantity: number | null;
};

const initial: ExternalActionState = {
  status: "idle",
  message: "",
  submissionId: "",
};

export function ExternalOrderForm({
  minimumDate,
  maximumDate,
  products,
}: {
  minimumDate: string;
  maximumDate: string;
  products: ProductChoice[];
}) {
  const [result, action, pending] = useActionState(
    createExternalOrder,
    initial,
  );
  const [rows, setRows] = useState([0]);
  const [nextRow, setNextRow] = useState(1);
  const [selections, setSelections] = useState<Record<number, string>>({});
  useEffect(() => {
    if (result.status === "success")
      window.scrollTo({ top: 0, behavior: "smooth" });
  }, [result.submissionId, result.status]);

  if (result.status === "success" && result.orderId) {
    return (
      <div
        role="status"
        className="border-success-ink/30 bg-success grid gap-4 border p-5"
      >
        <h2 className="text-lg font-bold">External order recorded</h2>
        <p className="text-sm leading-6">{result.message}</p>
        <Link
          href={`/admin/external-orders/${result.orderId}`}
          className="text-brand-strong font-bold underline"
        >
          View the order and track preparation
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-7">
      {result.status === "error" ? (
        <p
          role="alert"
          className="border-critical-ink/30 bg-critical text-critical-ink border p-3 text-sm font-semibold"
        >
          {result.message}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="external-date" label="Delivery date" required>
          {(props) => (
            <Input
              {...props}
              name="date"
              type="date"
              min={minimumDate}
              max={maximumDate}
              required
            />
          )}
        </Field>
        <Field id="external-source" label="Where the order came from" required>
          {(props) => (
            <Select {...props} name="source" required defaultValue="phone">
              <option value="phone">Phone</option>
              <option value="instagram">Instagram</option>
              <option value="admin">Owner-entered</option>
              <option value="other">Other</option>
            </Select>
          )}
        </Field>
      </div>

      <fieldset className="border-border grid gap-4 border p-4 sm:grid-cols-2">
        <legend className="px-2 text-base font-bold">
          Customer & delivery
        </legend>
        <Field id="external-name" label="Customer name" required>
          {(props) => (
            <Input {...props} name="customerName" maxLength={120} required />
          )}
        </Field>
        <Field id="external-phone" label="Canadian phone number" required>
          {(props) => (
            <Input
              {...props}
              name="customerPhone"
              type="tel"
              autoComplete="tel"
              placeholder="416 555 0100"
              maxLength={30}
              required
            />
          )}
        </Field>
        <Field id="external-email" label="Email (optional)">
          {(props) => (
            <Input
              {...props}
              name="customerEmail"
              type="email"
              autoComplete="email"
              maxLength={254}
            />
          )}
        </Field>
        <Field id="external-recipient" label="Recipient name" required>
          {(props) => (
            <Input {...props} name="recipientName" maxLength={120} required />
          )}
        </Field>
        <Field id="external-street" label="Street address" required>
          {(props) => (
            <Input
              {...props}
              name="addressLine1"
              autoComplete="address-line1"
              maxLength={160}
              required
            />
          )}
        </Field>
        <Field id="external-unit" label="Unit (optional)">
          {(props) => (
            <Input
              {...props}
              name="addressLine2"
              autoComplete="address-line2"
              maxLength={100}
            />
          )}
        </Field>
        <Field id="external-city" label="City" required>
          {(props) => (
            <Select {...props} name="city" defaultValue="Toronto" required>
              <option>Toronto</option>
              <option>Markham</option>
              <option>Mississauga</option>
            </Select>
          )}
        </Field>
        <Field id="external-postal" label="Postal code" required>
          {(props) => (
            <Input
              {...props}
              name="postalCode"
              autoComplete="postal-code"
              placeholder="M5V 3L9"
              maxLength={7}
              required
            />
          )}
        </Field>
        <Field
          id="external-instructions"
          label="Delivery instructions"
          className="sm:col-span-2"
        >
          {(props) => (
            <Textarea
              {...props}
              name="deliveryInstructions"
              maxLength={500}
              className="min-h-20"
            />
          )}
        </Field>
        <label className="flex items-start gap-3 text-sm sm:col-span-2">
          <input
            type="checkbox"
            name="confirmAddress"
            className="accent-brand mt-1 size-4"
          />
          <span>
            I have reviewed the complete delivery address. If Google suggests a
            correction, I approve its verified version.
          </span>
        </label>
      </fieldset>

      <fieldset className="border-border grid gap-4 border p-4">
        <legend className="px-2 text-base font-bold">
          Pastries to prepare
        </legend>
        <p className="text-ink-soft text-sm">
          Use a separate row for each pastry. Add flavours, decorations, or
          other agreed details in its note.
        </p>
        {rows.map((row, index) => {
          const selected = products.find(
            (product) => product.id === selections[row],
          );
          return (
            <div
              key={row}
              className="border-border grid gap-3 border-b pb-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_7rem_auto] sm:items-end"
            >
              <Field
                id={`external-product-${row}`}
                label={`Pastry ${index + 1}`}
                required
              >
                {(props) => (
                  <Select
                    {...props}
                    name="productId"
                    required
                    value={selections[row] ?? ""}
                    onChange={(event) =>
                      setSelections((current) => ({
                        ...current,
                        [row]: event.target.value,
                      }))
                    }
                  >
                    <option value="" disabled>
                      Choose a pastry
                    </option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} · min {product.minimumQuantity}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field id={`external-quantity-${row}`} label="Quantity" required>
                {(props) => (
                  <Input
                    {...props}
                    key={selected?.id ?? "none"}
                    name="quantity"
                    type="number"
                    min={selected?.minimumQuantity ?? 1}
                    max={selected?.maximumQuantity ?? 10000}
                    step={selected?.quantityStep ?? 1}
                    defaultValue={selected?.minimumQuantity ?? 4}
                    required
                  />
                )}
              </Field>
              <Button
                type="button"
                variant="quiet"
                size="sm"
                aria-label={`Remove pastry ${index + 1}`}
                disabled={rows.length === 1}
                onClick={() =>
                  setRows((current) => current.filter((id) => id !== row))
                }
              >
                <Trash2 className="size-4" aria-hidden="true" /> Remove
              </Button>
              <Field
                id={`external-item-note-${row}`}
                label="Flavour or decoration note (optional)"
                className="sm:col-span-3"
              >
                {(props) => (
                  <Input {...props} name="itemNote" maxLength={300} />
                )}
              </Field>
            </div>
          );
        })}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="justify-self-start"
          disabled={rows.length >= 50}
          onClick={() => {
            setRows((current) => [...current, nextRow]);
            setNextRow((value) => value + 1);
          }}
        >
          <Plus className="size-4" aria-hidden="true" /> Add another pastry
        </Button>
      </fieldset>

      <Field id="external-private-note" label="Private owner note (optional)">
        {(props) => (
          <Textarea
            {...props}
            name="internalNote"
            maxLength={500}
            className="min-h-20"
          />
        )}
      </Field>
      <div className="border-warning-ink/25 bg-warning p-4 text-sm leading-6">
        This records a delivery and reserves one daily space. It does not charge
        the customer, confirm payment, send an email, or create a
        customer-tracking link.
      </div>
      <Button
        type="submit"
        isLoading={pending}
        loadingLabel="Checking and saving…"
        className="justify-self-start"
      >
        Save external order
      </Button>
    </form>
  );
}
