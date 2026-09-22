"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  PackageCheck,
  RefreshCw,
} from "lucide-react";

import { useCart } from "@/components/cart/cart-provider";
import { CartSubtotal } from "@/components/cart/cart-subtotal";
import { serializeCart } from "@/lib/cart/schema";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  availabilityMonthSchema,
  checkoutDraftSummarySchema,
} from "@/lib/fulfillment/schema";
import type {
  AvailabilityDay,
  AvailabilityMonth,
  CheckoutDraftSummary,
} from "@/lib/fulfillment/types";
import { cn } from "@/lib/utils/cn";

type LoadState =
  | { status: "loading"; data: AvailabilityMonth | null; message: null }
  | { status: "ready"; data: AvailabilityMonth; message: null }
  | { status: "error"; data: AvailabilityMonth | null; message: string };

type SaveState =
  | { status: "idle"; message: null }
  | { status: "saving"; message: null }
  | { status: "error"; message: string };

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function errorMessage(body: unknown, fallback: string) {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "object" &&
    body.error !== null &&
    "message" in body.error &&
    typeof body.error.message === "string"
  ) {
    return body.error.message;
  }
  return fallback;
}

function CalendarGrid({
  availability,
  focusedDate,
  onFocusDate,
  onMonth,
  onSelect,
  selectedDate,
  compact = false,
}: {
  availability: AvailabilityMonth;
  focusedDate: string | null;
  onFocusDate: (date: string) => void;
  onMonth: (month: string) => void;
  onSelect: (day: AvailabilityDay) => void;
  selectedDate: string | null;
  compact?: boolean;
}) {
  const firstWeekday = availability.days[0]?.isoWeekday ?? 1;
  const cells = [
    ...Array.from({ length: firstWeekday - 1 }, () => null),
    ...availability.days,
  ];
  const weeks = Array.from(
    { length: Math.ceil(cells.length / 7) },
    (_, index) => cells.slice(index * 7, index * 7 + 7),
  );

  function moveFocus(
    event: React.KeyboardEvent<HTMLButtonElement>,
    dayIndex: number,
  ) {
    const changes: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
      Home: -dayIndex,
      End: availability.days.length - dayIndex - 1,
    };
    const change = changes[event.key];
    if (change === undefined) return;
    event.preventDefault();
    const target = Math.max(
      0,
      Math.min(availability.days.length - 1, dayIndex + change),
    );
    event.currentTarget
      .closest('[role="grid"]')
      ?.querySelector<HTMLButtonElement>(
        `[data-date="${availability.days[target]?.date}"]`,
      )
      ?.focus();
  }

  return (
    <section
      aria-labelledby="date-heading"
      className={
        compact ? "bg-surface" : "border-border bg-surface border p-4 sm:p-6"
      }
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-brand-strong text-xs font-bold tracking-[0.13em] uppercase">
            Delivery date
          </p>
          <h2 id="date-heading" className="text-ink mt-1 text-xl font-bold">
            {availability.monthLabel}
          </h2>
        </div>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="quiet"
            size="icon"
            disabled={!availability.previousMonth}
            onClick={() =>
              availability.previousMonth && onMonth(availability.previousMonth)
            }
            aria-label="Previous month"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="quiet"
            size="icon"
            disabled={!availability.nextMonth}
            onClick={() =>
              availability.nextMonth && onMonth(availability.nextMonth)
            }
            aria-label="Next month"
          >
            <ChevronRight className="size-5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-7" aria-hidden="true">
        {weekdayLabels.map((label) => (
          <span
            key={label}
            className="text-ink-faint pb-2 text-center text-[0.6875rem] font-bold tracking-[0.08em] uppercase"
          >
            {label}
          </span>
        ))}
      </div>
      <div
        role="grid"
        aria-label={`${availability.monthLabel} delivery availability`}
        className="grid gap-1 sm:gap-1.5"
      >
        {weeks.map((week, weekIndex) => (
          <div
            role="row"
            key={`week-${weekIndex}`}
            className="grid grid-cols-7 gap-1 sm:gap-1.5"
          >
            {week.map((day, weekDayIndex) => {
              const cellIndex = weekIndex * 7 + weekDayIndex;
              const dayIndex = cellIndex - (firstWeekday - 1);
              return day ? (
                <div
                  role="gridcell"
                  key={day.date}
                  className={compact ? "h-11 min-w-0" : "aspect-square min-w-0"}
                >
                  <button
                    type="button"
                    data-date={day.date}
                    aria-label={`${day.label}. ${day.selectable ? "Available" : (day.reason?.message ?? "Unavailable")}`}
                    aria-pressed={selectedDate === day.date}
                    aria-disabled={!day.selectable}
                    title={day.reason?.message}
                    tabIndex={focusedDate === day.date ? 0 : -1}
                    onFocus={() => onFocusDate(day.date)}
                    onKeyDown={(event) => moveFocus(event, dayIndex)}
                    onClick={() => onSelect(day)}
                    className={cn(
                      "focus-visible:ring-focus grid size-full place-items-center border text-sm font-bold tabular-nums transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                      compact ? "min-h-11" : "min-h-10 sm:min-h-12",
                      selectedDate === day.date
                        ? "border-brand bg-brand text-white"
                        : day.selectable
                          ? "border-border text-ink hover:border-brand hover:text-brand-strong bg-white"
                          : "bg-canvas-strong/75 text-ink-faint border-transparent line-through decoration-1",
                    )}
                  >
                    {day.dayNumber}
                  </button>
                </div>
              ) : (
                <span
                  role="gridcell"
                  key={`empty-${cellIndex}`}
                  aria-hidden="true"
                />
              );
            })}
          </div>
        ))}
      </div>
      <p className="text-ink-faint mt-4 text-xs leading-5">
        Toronto time. Crossed-out dates are unavailable.
      </p>
    </section>
  );
}

export function FulfillmentPlanner({
  initialDraft,
  initialMonth,
  initialDate,
  drawer = false,
  onDateChange,
  onBack,
  onSaved,
}: {
  initialDraft: CheckoutDraftSummary | null;
  initialMonth: string;
  initialDate?: string | null;
  drawer?: boolean;
  onDateChange?: (date: string | null) => void;
  onBack?: () => void;
  onSaved?: (draft: CheckoutDraftSummary) => void;
}) {
  const router = useRouter();
  const { cart, hydrated, priceChanges, refreshCart, validation } = useCart();
  const method = "delivery";
  const [month, setMonth] = useState(
    (initialDate ?? initialDraft?.date)?.slice(0, 7) ?? initialMonth,
  );
  const [availability, setAvailability] = useState<LoadState>({
    status: "loading",
    data: null,
    message: null,
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(
    initialDate ?? initialDraft?.date ?? null,
  );
  const [focusedDate, setFocusedDate] = useState<string | null>(
    initialDraft?.date ?? null,
  );
  const [selectionMessage, setSelectionMessage] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({
    status: "idle",
    message: null,
  });
  const savingRef = useRef(false);
  const mountedRef = useRef(true);
  const currentCartRef = useRef(cart);
  useEffect(() => {
    currentCartRef.current = cart;
  }, [cart]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => refreshCart(), [refreshCart]);

  const loadAvailability = useCallback(
    async (signal?: AbortSignal) => {
      setAvailability((current) => ({
        status: "loading",
        data: current.data,
        message: null,
      }));
      try {
        const response = await fetch(
          `/api/fulfillment/availability?method=${method}&month=${month}`,
          { cache: "no-store", credentials: "same-origin", signal },
        );
        const body: unknown = await response.json();
        if (!response.ok) {
          throw new Error(
            errorMessage(body, "Available dates could not be loaded."),
          );
        }
        const parsed = availabilityMonthSchema.safeParse(body);
        if (!parsed.success)
          throw new Error("Availability returned an unexpected response.");
        if (signal?.aborted || !mountedRef.current) return;
        setAvailability({ status: "ready", data: parsed.data, message: null });
        setFocusedDate((current) =>
          parsed.data.days.some((day) => day.date === current)
            ? current
            : (parsed.data.days.find((day) => day.selectable)?.date ??
              parsed.data.days[0]?.date ??
              null),
        );
        setSelectedDate((current) =>
          parsed.data.days.some((day) => day.date === current && day.selectable)
            ? current
            : null,
        );
      } catch (error) {
        if (signal?.aborted || !mountedRef.current) return;
        setAvailability((current) => ({
          status: "error",
          data: current.data,
          message:
            error instanceof Error
              ? error.message
              : "Available dates could not be loaded.",
        }));
      }
    },
    [method, month],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadAvailability(controller.signal);
    return () => controller.abort();
  }, [loadAvailability]);

  const cartReady =
    hydrated &&
    validation.status === "ready" &&
    validation.data.status === "ready" &&
    priceChanges.length === 0;
  const minimumNoticeDays = availability.data?.minimumNoticeDays;
  const cartNeedsReview =
    priceChanges.length > 0 ||
    validation.status === "error" ||
    (validation.status === "ready" && validation.data.status !== "ready");

  function chooseDay(day: AvailabilityDay) {
    if (savingRef.current || availability.status !== "ready") return;
    setFocusedDate(day.date);
    if (!day.selectable) {
      setSelectionMessage(day.reason?.message ?? "This date is unavailable.");
      return;
    }
    setSelectedDate(day.date);
    onDateChange?.(day.date);
    setSelectionMessage(`${day.label} selected.`);
    setSaveState({ status: "idle", message: null });
  }

  async function saveSelection() {
    if (
      !selectedDate ||
      !cartReady ||
      availability.status !== "ready" ||
      savingRef.current
    )
      return;
    savingRef.current = true;
    setSaveState({ status: "saving", message: null });
    try {
      const response = await fetch("/api/checkout/fulfillment", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cart, method, date: selectedDate }),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        throw new Error(errorMessage(body, "This date could not be saved."));
      }
      const draftBody =
        typeof body === "object" && body !== null && "draft" in body
          ? body.draft
          : null;
      const parsed = checkoutDraftSummarySchema.safeParse(draftBody);
      if (!parsed.success)
        throw new Error(
          "The saved delivery date returned an unexpected response.",
        );
      if (!mountedRef.current) return;
      if (serializeCart(currentCartRef.current) !== serializeCart(cart)) {
        throw new Error(
          "Your pastry box changed while saving. Review it and continue again.",
        );
      }
      if (onSaved) onSaved(parsed.data);
      else router.push("/checkout");
    } catch (error) {
      if (!mountedRef.current) return;
      setSaveState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "This date could not be saved.",
      });
      void loadAvailability();
    } finally {
      savingRef.current = false;
    }
  }

  if (
    !hydrated ||
    (cart.lines.length > 0 && !validation.data && validation.status !== "error")
  ) {
    return (
      <div className="grid min-h-80 place-items-center" role="status">
        <div className="text-ink-soft flex items-center gap-3 text-sm">
          <RefreshCw
            className="size-5 motion-safe:animate-spin"
            aria-hidden="true"
          />
          Confirming your pastry box…
        </div>
      </div>
    );
  }

  if (cart.lines.length === 0 || validation.data?.status === "empty") {
    return (
      <div className="border-border bg-surface grid place-items-center border px-5 py-16 text-center">
        <PackageCheck className="text-brand size-9" aria-hidden="true" />
        <h2 className="font-display text-ink mt-4 text-3xl">
          Choose your pastries first
        </h2>
        <p className="text-ink-soft mt-2 max-w-md text-sm leading-6">
          Your delivery date is connected to your current pastry cart.
        </p>
        <Link
          href="/menu"
          className={cn(buttonVariants({ size: "lg" }), "mt-6")}
        >
          Browse the pastry menu
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  return (
    <div
      className={drawer ? "flex min-h-0 flex-1 flex-col" : "grid min-w-0 gap-5"}
    >
      <div
        className={
          drawer
            ? "min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6"
            : "grid gap-5"
        }
      >
        {cartNeedsReview ? (
          <div
            className="border-warning-ink/25 bg-warning/55 text-warning-ink border p-4"
            role="alert"
          >
            <p className="font-bold">Review your cart before scheduling.</p>
            <p className="mt-1 text-sm leading-6">
              A menu item, quantity, availability, or price still needs
              attention.
            </p>
            {onBack ? (
              <Button variant="quiet" onClick={onBack}>
                Review your pastries
              </Button>
            ) : (
              <Link
                href="/cart"
                className="mt-3 inline-flex min-h-11 items-center font-bold underline underline-offset-4"
              >
                Return to your cart
              </Link>
            )}
          </div>
        ) : null}

        {availability.data ? (
          <CalendarGrid
            availability={availability.data}
            compact={drawer}
            focusedDate={focusedDate}
            onFocusDate={setFocusedDate}
            onMonth={(nextMonth) => {
              if (savingRef.current) return;
              setMonth(nextMonth);
              setSelectedDate(null);
              setSelectionMessage(null);
            }}
            onSelect={chooseDay}
            selectedDate={selectedDate}
          />
        ) : availability.status === "loading" ? (
          <div
            className="border-border bg-surface grid min-h-96 place-items-center border"
            role="status"
          >
            <span className="text-ink-soft flex items-center gap-3 text-sm">
              <RefreshCw
                className="size-5 motion-safe:animate-spin"
                aria-hidden="true"
              />
              Loading Toronto availability…
            </span>
          </div>
        ) : null}

        {availability.status === "error" ? (
          <div
            className="bg-critical/65 text-critical-ink border border-current/20 p-4"
            role="alert"
          >
            <p className="font-bold">Availability could not be refreshed.</p>
            <p className="mt-1 text-sm leading-6">{availability.message}</p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => void loadAvailability()}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Retry
            </Button>
          </div>
        ) : null}

        <p
          className="sr-only"
          aria-live="polite"
          aria-atomic="true"
          data-fulfillment-announcer
        >
          {selectionMessage}
        </p>

        {drawer ? (
          <p className="text-ink-soft text-xs leading-5">
            {minimumNoticeDays ? `${minimumNoticeDays} days’ notice. ` : ""}
            Order up to two months ahead. Wednesdays, Sundays and December 25
            are closed.
          </p>
        ) : null}
        {selectionMessage ? (
          <p className="text-brand-strong text-sm font-semibold">
            {selectionMessage}
          </p>
        ) : null}
      </div>

      <div
        className={
          drawer
            ? "safe-bottom border-border bg-surface shrink-0 border-t px-4 pt-4 pb-4 sm:px-6"
            : "border-border bg-surface border p-4 sm:p-5"
        }
      >
        {drawer ? (
          <div className="mb-3">
            <CartSubtotal />
          </div>
        ) : null}
        {saveState.status === "error" ? (
          <p className="text-critical-ink mb-3 text-sm font-bold" role="alert">
            {saveState.message}
          </p>
        ) : null}
        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={
            !cartReady ||
            !selectedDate ||
            availability.status !== "ready" ||
            saveState.status === "saving"
          }
          onClick={() => void saveSelection()}
        >
          {saveState.status === "saving" ? (
            <>
              <RefreshCw
                className="size-4 motion-safe:animate-spin"
                aria-hidden="true"
              />
              Rechecking this date…
            </>
          ) : (
            <>
              {drawer
                ? "Continue to checkout"
                : "Continue to contact information"}
              <ArrowRight className="size-4" aria-hidden="true" />
            </>
          )}
        </Button>
        <p className="text-ink-faint mt-2 text-center text-xs leading-5">
          {drawer
            ? "Contact information & payment next. Date secured after payment."
            : "Choosing a date does not take one of the four daily order spaces."}
        </p>
      </div>

      {!drawer ? (
        <>
          <div className="border-border bg-butter-soft/45 border p-5">
            <div className="flex gap-3">
              <CalendarDays
                className="text-brand mt-0.5 size-5 shrink-0"
                aria-hidden="true"
              />
              <div>
                <p className="text-ink font-bold">
                  {minimumNoticeDays
                    ? `${minimumNoticeDays} ${minimumNoticeDays === 1 ? "day" : "days"}’ notice`
                    : "Minimum notice applies"}
                </p>
                <p className="text-ink-soft mt-1 text-sm leading-6">
                  Order up to two calendar months ahead. Wednesdays, Sundays,
                  and December 25 are closed.
                </p>
              </div>
            </div>
          </div>

          <Link
            href="/cart"
            className="text-brand-strong inline-flex min-h-11 items-center gap-2 text-sm font-bold underline underline-offset-4"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to your cart
          </Link>
        </>
      ) : null}
    </div>
  );
}
