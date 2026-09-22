"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, MapPin, RefreshCw } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { CartEditButton } from "@/components/cart/cart-edit-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { formatCents } from "@/lib/catalog/presentation";
import { serializeCart } from "@/lib/cart/schema";
import {
  deliveryInputSchema,
  deliveryStateSchema,
  type DeliveryInput,
  type DeliveryState,
} from "@/lib/delivery/schema";
import { businessConfig } from "@/lib/config/business";

type Problem = { code: string; message: string };
const DELIVERY_CITIES = ["Toronto", "Markham", "Mississauga"] as const;

const emptyInput: DeliveryInput = {
  name: "",
  email: "",
  phone: "",
  recipientName: "",
  instructions: "",
  address: {
    line1: "",
    line2: "",
    city: "",
    province: "ON",
    country: "CA",
    postalCode: "",
  },
};

function phoneNumberForDisplay(value: string) {
  const digits = value.replace(/\D/g, "");
  return value.trim().startsWith("+1") && digits.length === 11
    ? digits.slice(1)
    : value;
}

async function api(
  method: "GET" | "PUT" | "POST",
  body?: unknown,
  action?: string,
): Promise<DeliveryState> {
  const response = await fetch(
    `/api/checkout/delivery${action ? `?action=${action}` : ""}`,
    {
      method,
      credentials: "same-origin",
      cache: "no-store",
      ...(body
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
    },
  );
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(
      typeof data?.error?.message === "string"
        ? data.error.message
        : "We could not save your delivery details. Please retry.",
    );
    Object.assign(error, { code: data?.error?.code ?? "unavailable" });
    throw error;
  }
  return deliveryStateSchema.parse(data.delivery);
}

export function DeliveryDetails({
  embedded = false,
  locked = false,
  onStateChange,
  refreshKey = 0,
}: {
  embedded?: boolean;
  locked?: boolean;
  onStateChange?: (delivery: DeliveryState | null) => void;
  refreshKey?: number;
}) {
  const { cart, hydrated, validation, priceChanges } = useCart();
  const [delivery, setDelivery] = useState<DeliveryState | null>(null);
  const [input, setInput] = useState<DeliveryInput>(emptyInput);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"saving" | "checking" | "confirming" | null>(
    null,
  );
  const [problem, setProblem] = useState<Problem | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [quoteExpired, setQuoteExpired] = useState(false);
  const inFlight = useRef(false);
  const edited = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const publish = useCallback(
    (next: DeliveryState) => {
      setDelivery(next);
      onStateChange?.(next);
    },
    [onStateChange],
  );

  const report = useCallback(
    (error: unknown) => {
      const code =
        error instanceof Error && "code" in error
          ? String(error.code)
          : "unavailable";
      if (
        [
          "quote_stale",
          "cart_changed",
          "schedule_changed",
          "draft_expired",
          "details_conflict",
        ].includes(code)
      ) {
        setDelivery((current) =>
          current ? { ...current, quote: null, status: "stale" } : current,
        );
        onStateChange?.(null);
      }
      setProblem({
        code:
          error instanceof Error && "code" in error
            ? String(error.code)
            : "unavailable",
        message:
          error instanceof Error
            ? error.message
            : "We could not save your details. Please retry.",
      });
    },
    [onStateChange],
  );
  const reload = useCallback(async () => {
    try {
      const saved = await api("GET");
      publish(saved);
      setInput(saved.input ?? emptyInput);
      setDirty(false);
      edited.current = false;
      setProblem(null);
      setFieldErrors({});
      setQuoteExpired(false);
    } catch (error) {
      report(error);
    } finally {
      setLoading(false);
    }
  }, [publish, report]);
  useEffect(() => {
    const timer = window.setTimeout(() => void reload(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshKey, reload]);
  useEffect(() => {
    if (problem || Object.keys(fieldErrors).length) errorRef.current?.focus();
  }, [problem, fieldErrors]);
  useEffect(() => {
    const expiry = delivery?.quote?.expiresAt;
    if (!expiry) return;
    const remaining = new Date(expiry).getTime() - Date.now();
    const timer = window.setTimeout(
      () => {
        setQuoteExpired(true);
        onStateChange?.(null);
      },
      Math.max(0, remaining),
    );
    return () => clearTimeout(timer);
  }, [delivery, onStateChange]);
  useEffect(() => {
    async function refreshStatus() {
      if (edited.current || inFlight.current) return;
      try {
        const saved = await api("GET");
        if (!edited.current && !inFlight.current) {
          publish(saved);
          setInput(saved.input ?? emptyInput);
          setQuoteExpired(false);
        }
      } catch (error) {
        if (!edited.current) report(error);
      }
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshStatus();
    };
    window.addEventListener("focus", refreshStatus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", refreshStatus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [publish, report]);

  const cartMatches = Boolean(
    delivery && serializeCart(cart) === serializeCart(delivery.cart),
  );
  const cartReady =
    hydrated &&
    validation.status === "ready" &&
    validation.data.status === "ready" &&
    !priceChanges.length &&
    cartMatches;
  const quote = !dirty && !quoteExpired && cartReady ? delivery?.quote : null;
  const confirmed = Boolean(quote && delivery?.status === "confirmed");

  function edit(path: string, value: string) {
    edited.current = true;
    setDirty(true);
    setProblem(null);
    onStateChange?.(null);
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[path];
      return next;
    });
    setInput((current) =>
      path.startsWith("address.")
        ? {
            ...current,
            address: { ...current.address, [path.slice(8)]: value },
          }
        : { ...current, [path]: value },
    );
  }
  async function checkDelivery(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !delivery || !cartReady) return;
    const parsed = deliveryInputSchema.safeParse(input);
    if (!parsed.success) {
      setFieldErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            issue.path.join("."),
            issue.message,
          ]),
        ),
      );
      return;
    }
    inFlight.current = true;
    setProblem(null);
    setFieldErrors({});
    try {
      setBusy("saving");
      const saved = await api("PUT", {
        input: parsed.data,
        version: delivery.version,
        draftVersion: delivery.draftVersion,
        cart,
      });
      publish(saved);
      setInput(saved.input ?? parsed.data);
      setDirty(false);
      edited.current = false;
      setBusy("checking");
      const checked = await api(
        "POST",
        { version: saved.version, draftVersion: saved.draftVersion, cart },
        "quote",
      );
      publish(checked);
      setQuoteExpired(false);
    } catch (error) {
      report(error);
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }
  async function confirmAddress() {
    if (inFlight.current || !delivery || !quote || !cartReady) return;
    inFlight.current = true;
    setBusy("confirming");
    setProblem(null);
    try {
      const saved = await api(
        "POST",
        {
          version: delivery.version,
          draftVersion: delivery.draftVersion,
          cart,
        },
        "confirm",
      );
      publish(saved);
    } catch (error) {
      report(error);
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  function inputField(
    path: string,
    label: string,
    value: string,
    autoComplete: string,
    options: {
      type?: string;
      max?: number;
      optional?: boolean;
      className?: string;
    } = {},
  ) {
    return (
      <Field
        id={`delivery-${path.replace(".", "-")}`}
        label={label}
        required={!options.optional}
        error={fieldErrors[path]}
        className={options.className}
      >
        {(props) => (
          <Input
            {...props}
            name={path}
            value={value}
            type={options.type ?? "text"}
            autoComplete={autoComplete}
            maxLength={options.max ?? 160}
            required={!options.optional}
            disabled={locked || Boolean(busy)}
            onChange={(event) => edit(path, event.currentTarget.value)}
          />
        )}
      </Field>
    );
  }

  if (loading)
    return (
      <p role="status" className="text-ink-soft py-10">
        Loading your delivery details…
      </p>
    );
  if (!delivery)
    return (
      <section className="border-border max-w-xl border bg-white p-6">
        <p role={embedded ? "status" : "alert"} className="text-ink font-bold">
          {problem?.message ?? "Choose your delivery date to continue."}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <CartEditButton
            step="date"
            className={buttonVariants({ variant: "secondary" })}
          >
            Choose delivery date
          </CartEditButton>
          <Button
            variant="quiet"
            onClick={() => {
              setLoading(true);
              void reload();
            }}
          >
            Retry
          </Button>
        </div>
      </section>
    );

  return (
    <div
      className={
        embedded
          ? "min-w-0"
          : "grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]"
      }
    >
      <div className="min-w-0">
        {locked ? (
          <div
            className="border-border bg-butter-soft/55 text-ink mb-5 border p-4 text-sm leading-6"
            role="status"
          >
            Payment is in progress. Stop the payment attempt below before
            changing these details.
          </div>
        ) : null}
        {problem || Object.keys(fieldErrors).length ? (
          <div
            ref={errorRef}
            role="alert"
            tabIndex={-1}
            className="border-critical-ink/30 bg-critical text-critical-ink mb-5 border p-4 outline-offset-4"
          >
            <p className="font-bold">
              {problem?.message ?? "Please check your details below."}
            </p>
            {Object.entries(fieldErrors).length > 0 ? (
              <ul className="mt-2 list-inside list-disc text-sm">
                {Object.entries(fieldErrors).map(([key, message]) => (
                  <li key={key}>
                    <a
                      href={`#delivery-${key.replace(".", "-")}`}
                      className="underline"
                    >
                      {message}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
            {problem?.code === "details_conflict" ? (
              <Button
                variant="quiet"
                className="mt-3"
                onClick={() => void reload()}
              >
                Reload saved details
              </Button>
            ) : null}
            {["cart_changed", "schedule_changed", "draft_expired"].includes(
              problem?.code ?? "",
            ) ? (
              <CartEditButton
                step="date"
                disabled={locked}
                className="mt-3 inline-flex min-h-11 items-center font-bold underline"
              >
                Review delivery date
              </CartEditButton>
            ) : null}
          </div>
        ) : null}
        {!cartReady ? (
          <div
            role="status"
            className="bg-warning text-warning-ink mb-5 p-4 text-sm"
          >
            {hydrated && !cartMatches
              ? "Your pastry box changed. Review your cart and save your delivery date again."
              : "Checking your pastry box. Resolve any cart changes before continuing."}
            <CartEditButton className="ml-2 inline-flex min-h-11 items-center font-bold underline">
              Review cart
            </CartEditButton>
          </div>
        ) : null}
        <form
          noValidate
          onSubmit={(event) => void checkDelivery(event)}
          className="checkout-form grid gap-6"
        >
          <fieldset
            className="min-w-0 border-0 p-0"
            disabled={locked || Boolean(busy)}
          >
            <legend className="text-ink mb-3 p-0 text-lg font-bold">
              Your details
            </legend>
            <div className="grid gap-x-3 gap-y-3 sm:grid-cols-2">
              {inputField("name", "Full name", input.name, "name", {
                max: 100,
              })}
              {inputField("email", "Email address", input.email, "email", {
                type: "email",
                max: 254,
              })}
              <Field
                id="delivery-phone"
                label="Canadian phone number"
                required
                error={fieldErrors.phone}
              >
                {(props) => (
                  <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2">
                    <Select
                      aria-label="Country calling code"
                      name="phoneCountryCode"
                      value="+1"
                      autoComplete="tel-country-code"
                      required
                      disabled={locked || Boolean(busy)}
                      onChange={() => undefined}
                    >
                      <option value="+1">+1</option>
                    </Select>
                    <Input
                      {...props}
                      name="phone"
                      value={phoneNumberForDisplay(input.phone)}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel-national"
                      maxLength={20}
                      placeholder="416 555 0100"
                      required
                      disabled={locked || Boolean(busy)}
                      onChange={(event) =>
                        edit("phone", event.currentTarget.value)
                      }
                    />
                  </div>
                )}
              </Field>
            </div>
            <p className="text-ink-soft mt-3 text-xs leading-5">
              Use a 10-digit Canadian number for delivery updates.
            </p>
          </fieldset>
          <fieldset
            className="min-w-0 border-0 p-0"
            disabled={locked || Boolean(busy)}
          >
            <legend className="text-ink mb-3 p-0 text-lg font-bold">
              Delivery address
            </legend>
            <div className="grid gap-x-3 gap-y-3 sm:grid-cols-2">
              {inputField(
                "recipientName",
                "Recipient name",
                input.recipientName,
                "shipping name",
                { max: 100, className: "sm:col-span-2" },
              )}
              {inputField(
                "address.line1",
                "Street address",
                input.address.line1,
                "shipping address-line1",
                { className: "sm:col-span-2" },
              )}
              {inputField(
                "address.line2",
                "Apartment, suite or unit (optional)",
                input.address.line2,
                "shipping address-line2",
                { max: 80, optional: true },
              )}
              <Field
                id="delivery-address-city"
                label="City"
                required
                error={fieldErrors["address.city"]}
              >
                {(props) => (
                  <Select
                    {...props}
                    name="address.city"
                    value={input.address.city}
                    autoComplete="shipping address-level2"
                    required
                    disabled={locked || Boolean(busy)}
                    onChange={(event) =>
                      edit("address.city", event.currentTarget.value)
                    }
                  >
                    <option value="" disabled>
                      Select a delivery city
                    </option>
                    {DELIVERY_CITIES.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field id="delivery-province" label="Province" required>
                {(props) => (
                  <Select
                    {...props}
                    name="address.province"
                    value={input.address.province}
                    autoComplete="shipping address-level1"
                    required
                    disabled={locked || Boolean(busy)}
                    onChange={() => edit("address.province", "ON")}
                  >
                    <option value="ON">Ontario</option>
                  </Select>
                )}
              </Field>
              {inputField(
                "address.postalCode",
                "Postal code",
                input.address.postalCode,
                "shipping postal-code",
                { max: 10 },
              )}
              <Field id="delivery-country" label="Country" required>
                {(props) => (
                  <Select
                    {...props}
                    name="address.country"
                    value={input.address.country}
                    autoComplete="shipping country-name"
                    required
                    disabled={locked || Boolean(busy)}
                    onChange={() => edit("address.country", "CA")}
                  >
                    <option value="CA">Canada</option>
                  </Select>
                )}
              </Field>
              <Field
                id="delivery-instructions"
                label="Delivery instructions (optional)"
                error={fieldErrors.instructions}
                className="sm:col-span-2"
              >
                {(props) => (
                  <Textarea
                    {...props}
                    name="instructions"
                    rows={2}
                    placeholder="Buzzer number or where to meet you"
                    value={input.instructions}
                    maxLength={500}
                    onChange={(event) =>
                      edit("instructions", event.currentTarget.value)
                    }
                  />
                )}
              </Field>
            </div>
            <p className="text-ink-soft mt-4 text-xs leading-5">
              We currently deliver only to eligible addresses in Toronto,
              Markham, and Mississauga, Ontario.
            </p>
            <p className="text-ink-soft mt-4 text-xs leading-5">
              We check your address and driving route using Google Maps.{" "}
              <a
                className="underline"
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noreferrer"
              >
                Google Privacy Policy
              </a>{" "}
              ·{" "}
              <a
                className="underline"
                href="https://maps.google.com/help/terms_maps/"
                target="_blank"
                rel="noreferrer"
              >
                Google Maps Terms
              </a>
            </p>
          </fieldset>
          <div>
            <Button
              type="submit"
              size="lg"
              className="w-full sm:w-auto"
              disabled={!cartReady || locked || Boolean(busy)}
            >
              {busy ? (
                <RefreshCw
                  className="size-4 motion-safe:animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <MapPin className="size-4" aria-hidden="true" />
              )}
              {busy === "saving"
                ? "Saving your details…"
                : busy === "checking"
                  ? "Checking delivery…"
                  : "Save and check delivery"}
            </Button>
            <p className="text-ink-soft mt-2 text-xs leading-5">
              Your delivery fee appears before payment. No order is placed at
              this step.
            </p>
          </div>
        </form>
        {(delivery.status === "stale" || quoteExpired) && !dirty ? (
          <p
            role="status"
            className="bg-warning text-warning-ink mt-5 p-4 text-sm"
          >
            This delivery quote needs refreshing. Check delivery again for the
            latest fee.
          </p>
        ) : null}
        {quote ? (
          <section
            aria-labelledby="delivery-review-heading"
            className="border-brand mt-7 border bg-white p-4 sm:p-6"
          >
            <h2
              id="delivery-review-heading"
              className="text-ink text-xl font-bold"
            >
              {confirmed
                ? "Delivery details confirmed"
                : "Review your delivery address"}
            </h2>
            {quote.requiresConfirmation && !confirmed ? (
              <p className="text-ink-soft mt-2 text-sm leading-6">
                Google Maps suggested these address details. Check that this is
                where your pastries should go.
              </p>
            ) : null}
            <address className="text-ink mt-4 text-sm leading-6 not-italic">
              {quote.address.line1}
              <br />
              {quote.address.line2 ? (
                <>
                  {quote.address.line2}
                  <br />
                </>
              ) : null}
              {quote.address.city}, ON {quote.address.postalCode}
              <br />
              Canada
            </address>
            <p
              translate="no"
              className="mt-2 text-xs font-normal whitespace-nowrap text-[#5E5E5E]"
            >
              Google Maps
            </p>
            <div className="border-border mt-5 space-y-2 border-t pt-4 text-sm">
              <p className="flex justify-between gap-4">
                <span>Pastries</span>
                <span>{formatCents(quote.subtotalCents)}</span>
              </p>
              <p className="flex justify-between gap-4">
                <span>Delivery</span>
                <span>
                  {quote.freeDelivery ? "Free" : formatCents(quote.feeCents)}
                </span>
              </p>
              <p className="flex justify-between gap-4 font-bold">
                <span>Order total</span>
                <span>{formatCents(quote.subtotalCents + quote.feeCents)}</span>
              </p>
            </div>
            {confirmed ? (
              <p
                role="status"
                className="bg-success text-success-ink mt-5 flex gap-2 p-4 text-sm"
              >
                <Check className="size-5 shrink-0" aria-hidden="true" />
                Your delivery details are saved. Your order has not been placed.
              </p>
            ) : (
              <Button
                size="lg"
                className="mt-5 w-full sm:w-auto"
                disabled={locked || Boolean(busy)}
                onClick={() => void confirmAddress()}
              >
                {busy === "confirming"
                  ? "Confirming…"
                  : "Confirm address and delivery fee"}
              </Button>
            )}
            {confirmed && !embedded ? (
              <Link
                href="/checkout#payment"
                className="bg-brand hover:bg-brand-strong mt-5 inline-flex min-h-12 w-full items-center justify-center px-6 py-3 text-sm font-bold text-white sm:w-auto"
              >
                Continue to review & pay
              </Link>
            ) : null}
          </section>
        ) : null}
      </div>
      {!embedded ? (
        <aside className="grid min-w-0 gap-4">
          <div className="border-border bg-butter-soft/45 border p-5">
            <h2 className="text-brand-strong text-xs font-bold tracking-[0.13em] uppercase">
              Your pastry delivery
            </h2>
            <p className="text-ink mt-4 font-bold">{delivery.dateLabel}</p>
            <CartEditButton
              step="date"
              disabled={locked}
              className="text-brand-strong mt-3 inline-flex min-h-11 items-center text-sm font-bold underline"
            >
              Change delivery date
            </CartEditButton>
          </div>
          <div className="border-border border bg-white p-5 text-sm leading-6">
            <p className="text-ink font-bold">A little help?</p>
            <p className="text-ink-soft mt-1">
              For questions about your delivery, call{" "}
              <a
                href={businessConfig.supportPhoneHref}
                className="text-brand-strong underline"
              >
                {businessConfig.supportPhoneDisplay}
              </a>
              .
            </p>
          </div>
          <CartEditButton className="text-brand-strong inline-flex min-h-11 items-center gap-2 text-sm font-bold underline underline-offset-4">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to your cart
          </CartEditButton>
        </aside>
      ) : null}
    </div>
  );
}
