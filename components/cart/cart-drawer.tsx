"use client";

import * as Dialog from "@radix-ui/react-dialog";
import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { ArrowRight, X } from "lucide-react";

import { CartContents } from "@/components/cart/cart-contents";
import { useCart } from "@/components/cart/cart-provider";
import { Button } from "@/components/ui/button";
import { CartSubtotal } from "@/components/cart/cart-subtotal";
import { cn } from "@/lib/utils/cn";

const CartDeliveryStep = dynamic(
  () =>
    import("@/components/cart/cart-delivery-step").then(
      (module) => module.CartDeliveryStep,
    ),
  {
    loading: () => (
      <p role="status" className="text-ink-soft p-6 text-sm">
        Loading delivery dates…
      </p>
    ),
  },
);

export function CartDrawer() {
  const {
    drawerOpen,
    drawerStep,
    itemCount,
    setDrawerOpen,
    setDrawerStep,
    closeCart,
    hydrated,
    cart,
    validation,
    priceChanges,
  } = useCart();
  const openerRef = useRef<HTMLElement | null>(null);
  const ready =
    hydrated &&
    validation.status === "ready" &&
    validation.data.status === "ready" &&
    priceChanges.length === 0;
  const hasItems = hydrated && cart.lines.length > 0;
  const step = hasItems ? drawerStep : "cart";
  const previousStep = useRef(step);
  const stepButtons = useRef<
    Partial<Record<"cart" | "date", HTMLButtonElement | null>>
  >({});
  useEffect(() => {
    if (drawerOpen && previousStep.current !== step)
      stepButtons.current[step]?.focus();
    previousStep.current = step;
  }, [drawerOpen, step]);

  return (
    <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-ink/45 data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in fixed inset-0 z-50 motion-reduce:animate-none" />
        <Dialog.Content
          className="border-border bg-surface-raised shadow-dialog data-[state=closed]:animate-drawer-out data-[state=open]:animate-drawer-in fixed inset-y-0 right-0 z-50 flex h-dvh w-full max-w-[34rem] flex-col border-l outline-none motion-reduce:animate-none"
          onOpenAutoFocus={() => {
            openerRef.current =
              document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
          }}
          onCloseAutoFocus={(event) => {
            if (openerRef.current?.isConnected) {
              event.preventDefault();
              openerRef.current.focus();
            }
          }}
        >
          <header className="border-border flex shrink-0 items-center justify-between gap-4 border-b px-4 py-4 sm:px-6 sm:py-5">
            <div>
              <Dialog.Title className="text-ink text-xl leading-7 font-normal">
                Your pastry box
              </Dialog.Title>
              <Dialog.Description className="text-ink-soft mt-1 text-xs">
                {itemCount} item{itemCount === 1 ? "" : "s"} · baked for your
                delivery
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="quiet" size="icon" aria-label="Close cart">
                <X className="size-5" aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </header>
          {hasItems ? (
            <nav
              aria-label="Order preparation"
              className="border-border grid shrink-0 grid-cols-2 border-b"
            >
              {(
                [
                  ["cart", "Your pastries"],
                  ["date", "Delivery date"],
                ] as const
              ).map(([value, label], index) => (
                <button
                  key={value}
                  ref={(element) => {
                    stepButtons.current[value] = element;
                  }}
                  type="button"
                  aria-current={step === value ? "step" : undefined}
                  onClick={() => setDrawerStep(value)}
                  className={cn(
                    "focus-visible:ring-focus flex min-h-14 items-center justify-center gap-2 border-b-2 px-2 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-inset",
                    step === value
                      ? "border-brand text-brand-strong"
                      : "text-ink-soft hover:text-brand-strong border-transparent",
                  )}
                >
                  <span aria-hidden="true" className="text-xs">
                    0{index + 1}
                  </span>
                  {label}
                </button>
              ))}
            </nav>
          ) : null}
          {step === "date" ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <CartDeliveryStep />
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6">
                <CartContents mode="drawer" showFooter={false} />
              </div>
              {hasItems ? (
                <footer className="safe-bottom border-border bg-surface-raised shrink-0 border-t px-4 pt-4 pb-3 sm:px-6">
                  <CartSubtotal />
                  <p className="text-ink-soft mt-1 text-xs">
                    Delivery calculated after your address.
                  </p>
                  <Button
                    size="lg"
                    className="mt-4 w-full"
                    disabled={!ready}
                    onClick={() => setDrawerStep("date")}
                  >
                    {ready
                      ? "Choose delivery date"
                      : priceChanges.length
                        ? "Review the price update"
                        : validation.status === "error" ||
                            validation.data?.status === "blocked"
                          ? "Review your cart above"
                          : "Checking your pastries…"}
                    <ArrowRight
                      className="size-4 shrink-0"
                      aria-hidden="true"
                    />
                  </Button>
                  <Button
                    variant="quiet"
                    className="mt-1 w-full text-sm"
                    onClick={closeCart}
                  >
                    Continue shopping
                  </Button>
                </footer>
              ) : null}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
