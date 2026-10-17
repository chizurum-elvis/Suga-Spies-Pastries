import type { ReactNode } from "react";
import { AdminLink as Link } from "@/components/navigation/admin-link";
import { ArrowUpRight, LogOut } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import { AdminMobileNav } from "@/components/navigation/admin-mobile-nav";
import { AdminNavItems } from "@/components/navigation/admin-nav-items";
import { Button } from "@/components/ui/button";
import { SkipLink } from "@/components/layout/skip-link";
import { signOutOwner } from "@/lib/auth/actions";
import type { OwnerIdentity } from "@/lib/auth/owner-access";

export function AdminShell({
  children,
  owner,
}: {
  children: ReactNode;
  owner: OwnerIdentity;
}) {
  return (
    <div className="admin-workspace text-ink min-h-dvh bg-[#f7f7f9]">
      <SkipLink />
      <header className="admin-chrome border-border sticky top-0 z-40 flex min-h-16 items-center justify-between gap-3 border-b bg-white px-4 lg:hidden">
        <Link href="/admin" className="text-sm font-bold">
          Suga &amp; Spies{" "}
          <span className="text-ink-soft ml-2 font-normal">Bakery manager</span>
        </Link>
        <AdminMobileNav ownerEmail={owner.email} signOutAction={signOutOwner} />
      </header>
      <aside className="admin-chrome border-border fixed inset-y-0 left-0 z-30 hidden w-60 flex-col overflow-y-auto border-r bg-white px-4 py-6 lg:flex">
        <div className="px-2">
          <BrandMark prefetch={false} />
          <p className="text-ink-soft mt-3 text-xs">Bakery manager</p>
        </div>
        <nav aria-label="Admin navigation" className="mt-8 flex-1">
          <AdminNavItems />
        </nav>
        <div className="border-border mt-8 border-t pt-4">
          <Link
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink-soft hover:text-brand flex min-h-11 items-center justify-between gap-2 px-3 text-sm"
          >
            View website <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
          <div className="mt-3 px-3">
            <p className="truncate text-sm font-bold">
              {owner.displayName ?? "Owner"}
            </p>
            <p
              className="text-ink-soft mt-1 truncate text-xs"
              title={owner.email}
            >
              {owner.email}
            </p>
          </div>
          <form action={signOutOwner} className="mt-3">
            <Button
              type="submit"
              variant="quiet"
              size="sm"
              className="w-full justify-start"
            >
              <LogOut className="size-4" aria-hidden="true" />
              Sign out
            </Button>
          </form>
        </div>
      </aside>
      <main
        id="main-content"
        tabIndex={-1}
        className="min-w-0 outline-none lg:pl-60"
      >
        <div className="mx-auto w-full max-w-[92rem] px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
          {children}
        </div>
        <footer className="admin-chrome border-border text-ink-soft mx-4 border-t py-5 text-xs sm:mx-6 lg:mx-8">
          Suga &amp; Spies · All dates and deadlines use Toronto time.
        </footer>
      </main>
    </div>
  );
}
