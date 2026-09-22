import type { ReactNode } from "react";
import { Clock3, LockKeyhole, LogOut } from "lucide-react";

import { BrandMark } from "@/components/brand/brand-mark";
import { AdminMobileNav } from "@/components/navigation/admin-mobile-nav";
import { AdminNavItems } from "@/components/navigation/admin-nav-items";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SkipLink } from "@/components/layout/skip-link";
import { signOutOwner } from "@/lib/auth/actions";
import type { OwnerIdentity } from "@/lib/auth/owner-access";
import { BUSINESS_TIME_ZONE } from "@/lib/config/business";

type AdminShellProps = {
  children: ReactNode;
  owner: OwnerIdentity;
};

export function AdminShell({ children, owner }: AdminShellProps) {
  return (
    <div className="text-ink min-h-dvh bg-[#f7f4ef]">
      <SkipLink />

      <header className="border-border bg-surface-raised/95 sticky top-0 z-40 flex min-h-16 items-center justify-between gap-4 border-b px-4 backdrop-blur md:hidden">
        <div>
          <p className="text-ink-faint text-xs font-bold tracking-[0.12em] uppercase">
            Owner workspace
          </p>
          <p className="text-ink text-sm font-extrabold">Suga Spies</p>
        </div>
        <AdminMobileNav ownerEmail={owner.email} signOutAction={signOutOwner} />
      </header>

      <aside className="border-border bg-surface-raised fixed inset-y-0 left-0 z-30 hidden w-20 flex-col border-r px-3 py-5 md:flex xl:w-72 xl:px-5">
        <div className="px-1 xl:px-0">
          <span className="xl:hidden">
            <BrandMark compact />
          </span>
          <span className="hidden xl:inline-flex">
            <BrandMark />
          </span>
        </div>

        <div className="mt-8 hidden xl:block">
          <Badge tone="accent">Owner workspace</Badge>
        </div>

        <nav aria-label="Admin navigation" className="mt-7 flex-1">
          <div className="xl:hidden">
            <AdminNavItems compact />
          </div>
          <div className="hidden xl:block">
            <AdminNavItems />
          </div>
        </nav>

        <div className="grid gap-3">
          <div className="border-border bg-canvas-strong text-ink-soft rounded-md border p-3 text-xs leading-5">
            <Clock3 className="mx-auto size-4 xl:mx-0" aria-hidden="true" />
            <p className="mt-2 hidden xl:block">
              Times and business cutoffs use {BUSINESS_TIME_ZONE}.
            </p>
            <span className="sr-only xl:hidden">
              Times use {BUSINESS_TIME_ZONE}.
            </span>
          </div>

          <div className="border-border bg-surface text-ink-soft hidden min-w-0 rounded-md border p-3 text-xs leading-5 xl:block">
            <LockKeyhole className="size-4" aria-hidden="true" />
            <p
              className="text-ink mt-2 truncate font-extrabold"
              title={owner.email}
            >
              {owner.displayName ?? "Owner"}
            </p>
            <p className="truncate" title={owner.email}>
              {owner.email}
            </p>
            <form action={signOutOwner} className="mt-3">
              <Button
                type="submit"
                variant="quiet"
                size="sm"
                className="w-full"
              >
                <LogOut className="size-4" aria-hidden="true" />
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </aside>

      <main
        id="main-content"
        tabIndex={-1}
        className="min-w-0 outline-none md:pl-20 xl:pl-72"
      >
        <div className="mx-auto w-full max-w-[100rem] px-4 py-6 sm:px-6 md:py-8 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
