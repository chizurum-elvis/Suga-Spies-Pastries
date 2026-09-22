"use client";

import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, Menu, X } from "lucide-react";

import { BrandMark } from "@/components/brand/brand-mark";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

const navigationItems = [
  { href: "/menu", label: "Pastry menu" },
  { href: "/#ordering", label: "Order guide" },
  { href: "/#service", label: "Delivery" },
] as const;

export function StorefrontMobileNav() {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button
          variant="secondary"
          size="icon"
          className="lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="size-5" aria-hidden="true" />
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-ink/55 data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in fixed inset-0 z-50 motion-reduce:animate-none" />
        <Dialog.Content className="safe-bottom border-border bg-surface-raised shadow-dialog data-[state=closed]:animate-dialog-out data-[state=open]:animate-dialog-in fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto border-l px-5 pt-4 motion-reduce:animate-none sm:px-7">
          <Dialog.Title className="sr-only">Suga Spies navigation</Dialog.Title>
          <div className="flex items-center justify-between gap-4">
            <BrandMark />
            <Dialog.Close asChild>
              <Button variant="quiet" size="icon" aria-label="Close navigation">
                <X className="size-5" aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>

          <Dialog.Description className="text-ink-soft mt-8 max-w-sm text-sm leading-6">
            Browse the starting pastry menu and see how scheduled delivery will
            work.
          </Dialog.Description>

          <nav aria-label="Mobile navigation" className="mt-7">
            <ul className="divide-border border-border divide-y border-y">
              {navigationItems.map((item) => (
                <li key={item.href}>
                  <Dialog.Close asChild>
                    <Link
                      href={item.href}
                      className="text-ink hover:text-brand flex min-h-16 items-center justify-between gap-4 rounded-sm py-3 text-lg font-semibold transition-colors focus-visible:outline-offset-[-2px]"
                    >
                      {item.label}
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  </Dialog.Close>
                </li>
              ))}
            </ul>
          </nav>

          <Dialog.Close asChild>
            <Link
              href="/menu"
              className={cn(buttonVariants({ size: "lg" }), "mt-auto w-full")}
            >
              Browse the menu
            </Link>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
