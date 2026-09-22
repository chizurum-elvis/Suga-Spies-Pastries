"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { LockKeyhole, LogOut, Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";

import { BrandMark } from "@/components/brand/brand-mark";
import { adminNavigationItems } from "@/components/navigation/admin-nav-items";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type AdminMobileNavProps = {
  ownerEmail: string;
  signOutAction: () => Promise<void>;
};

export function AdminMobileNav({
  ownerEmail,
  signOutAction,
}: AdminMobileNavProps) {
  const pathname = usePathname();
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button
          variant="secondary"
          size="icon"
          aria-label="Open admin navigation"
        >
          <Menu className="size-5" aria-hidden="true" />
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-ink/55 data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in fixed inset-0 z-50 motion-reduce:animate-none" />
        <Dialog.Content className="safe-bottom border-border bg-surface-raised shadow-dialog data-[state=closed]:animate-dialog-out data-[state=open]:animate-dialog-in fixed inset-y-0 left-0 z-50 flex w-[min(88vw,22rem)] flex-col overflow-y-auto border-r p-5 motion-reduce:animate-none">
          <Dialog.Title className="sr-only">
            Owner workspace navigation
          </Dialog.Title>
          <div className="flex items-center justify-between gap-4">
            <BrandMark />
            <Dialog.Close asChild>
              <Button
                variant="quiet"
                size="icon"
                aria-label="Close admin navigation"
              >
                <X className="size-5" aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="text-ink-soft mt-6 text-sm leading-6">
            Navigate the protected owner workspace. Customer and order data is
            not connected yet.
          </Dialog.Description>
          <nav aria-label="Admin navigation" className="mt-7">
            <ul className="grid gap-1.5">
              {adminNavigationItems.map((item) => {
                const Icon = item.icon;
                const itemPath = item.href.split("#")[0];
                const isCurrent =
                  itemPath === "/admin"
                    ? pathname === "/admin"
                    : pathname.startsWith(itemPath);
                return (
                  <li key={item.href}>
                    <Dialog.Close asChild>
                      <Link
                        href={item.href}
                        aria-current={isCurrent ? "page" : undefined}
                        className="text-ink-soft hover:bg-canvas-strong hover:text-ink aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand-strong flex min-h-12 items-center gap-3 rounded-md px-3 text-sm font-bold transition-colors"
                      >
                        <Icon className="size-5" aria-hidden="true" />
                        {item.label}
                      </Link>
                    </Dialog.Close>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="border-border bg-canvas-strong mt-auto min-w-0 rounded-md border p-4">
            <div className="flex items-start gap-3">
              <span className="bg-brand-soft text-brand-strong grid size-9 shrink-0 place-items-center rounded-md">
                <LockKeyhole className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-ink text-sm font-extrabold">Signed in</p>
                <p
                  className="text-ink-soft mt-0.5 truncate text-xs"
                  title={ownerEmail}
                >
                  {ownerEmail}
                </p>
              </div>
            </div>
            <form action={signOutAction} className="mt-4">
              <Button type="submit" variant="secondary" className="w-full">
                <LogOut className="size-4" aria-hidden="true" />
                Sign out
              </Button>
            </form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
